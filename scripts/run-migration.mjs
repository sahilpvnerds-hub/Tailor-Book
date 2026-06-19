/**
 * Plain ESM Node.js script to apply the orders migration SQL.
 * Run with: node scripts/run-migration.mjs
 * Reads DB credentials from .env or MYSQL_* env vars.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env if present
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("Loaded .env from:", envPath);
}

// Dynamic import mysql2 from the node_modules
const { default: mysql } = await import("mysql2/promise");

const host = process.env.MYSQL_HOST ?? "localhost";
const port = Number(process.env.MYSQL_PORT ?? 3306);
const user = process.env.MYSQL_USER ?? "root";
const password = process.env.MYSQL_PASSWORD ?? "admin123";
const database = process.env.MYSQL_DATABASE ?? "tailorbook";

// Also support DATABASE_URL
let connectionConfig;
if (process.env.DATABASE_URL) {
  connectionConfig = { uri: process.env.DATABASE_URL };
} else {
  connectionConfig = { host, port, user, password, database };
}

console.log(`Connecting to MySQL at ${host}:${port}/${database}...`);
const conn = await mysql.createConnection(connectionConfig);

const sqlFile = path.join(rootDir, "db", "migrate_orders.sql");
const sql = fs.readFileSync(sqlFile, "utf8");

// Split on semicolons (skip empty/comment-only segments)
const statements = sql
  .split(";")
  .map((s) =>
    s
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim()
  )
  .filter((s) => s.length > 0 && !s.toUpperCase().startsWith("USE "));

console.log(`Found ${statements.length} SQL statement(s) to execute.\n`);

let succeeded = 0;
let skipped = 0;

for (const stmt of statements) {
  const preview = stmt.replace(/\n/g, " ").substring(0, 90);
  try {
    await conn.query(stmt);
    console.log(`  ✅ OK: ${preview}...`);
    succeeded++;
  } catch (err) {
    // 1060 = Duplicate column name (column already added)
    // 1061 = Duplicate key name
    // 1050 = Table already exists
    if (err.errno === 1060 || err.errno === 1061 || err.errno === 1050) {
      console.warn(`  ⚠️  Skipped (already applied): ${err.sqlMessage}`);
      skipped++;
    } else if (err.errno === 1136 || err.code === "ER_COL_COUNT_DOESNT_MATCH_VALUE_COUNT") {
      console.warn(`  ⚠️  Skipped (non-critical): ${err.sqlMessage}`);
      skipped++;
    } else {
      console.error(`  ❌ Error: ${err.sqlMessage ?? err.message}`);
      console.error(`     Statement: ${preview}`);
      await conn.end();
      process.exit(1);
    }
  }
}

await conn.end();
console.log(`\nMigration complete — ${succeeded} applied, ${skipped} skipped.`);
