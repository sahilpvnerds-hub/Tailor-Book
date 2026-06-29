/**
 * Simple migration script to apply the order fixes
 * Run with: node artifacts/api-server/scripts/apply-migration.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// rootDir should be the project root, not artifacts/api-server
const rootDir = path.resolve(__dirname, "../../..");
const envPath = path.join(rootDir, ".env");
const mysql = (await import("mysql2/promise")).default;

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
}

async function runMigration() {
  const host = process.env.MYSQL_HOST ?? 'localhost';
  const port = Number(process.env.MYSQL_PORT ?? 3306);
  const user = process.env.MYSQL_USER ?? 'root';
  const password = process.env.MYSQL_PASSWORD ?? 'admin123';
  const database = process.env.MYSQL_DATABASE ?? 'tailorbook';

  const connectionConfig = {
    host, port, user, password, database
  };

  console.log(`Connecting to MySQL at ${host}:${port}/${database}...`);

  try {
    const conn = await mysql.createConnection(connectionConfig);
    console.log('✅ Connected to database');

    // Read migration SQL
    const sqlFile = path.join(rootDir, "db", "migrate_orders.sql");
    console.log("Reading migration from:", sqlFile);
    const sql = fs.readFileSync(sqlFile, "utf8");

    // Split and clean statements
    const statements = sql
      .split(";")
      .map((s) =>
        s
          .replace(/--.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .trim()
      )
      .filter((s) => s.length > 0 && !s.toUpperCase().startsWith("USE "));

    console.log(`\nFound ${statements.length} SQL statements to execute.\n`);

    let succeeded = 0;
    let skipped = 0;

    for (const stmt of statements) {
      const preview = stmt.replace(/\n/g, ' ').substring(0, 80);
      try {
        await conn.query(stmt);
        console.log(`  ✅ ${preview}...`);
        succeeded++;
      } catch (err) {
        // Ignore duplicate column/key errors
        if (err.errno === 1060 || err.errno === 1061 || err.errno === 1050) {
          console.log(`  ⚠️  Skipped (already exists): ${preview}...`);
          skipped++;
        } else if (err.errno === 1091 || err.errno === 1025) {
          console.log(`  ⚠️  Skipped (drop non-existent): ${preview}...`);
          skipped++;
        } else {
          console.error(`  ❌ Error: ${err.message}`);
          console.error(`     Statement: ${preview}`);
        }
      }
    }

    await conn.end();
    console.log(`\n✅ Migration complete — ${succeeded} applied, ${skipped} skipped.`);

    // Verify the changes
    console.log('\n📊 Verifying changes...\n');
    const verifyConn = await mysql.createConnection(connectionConfig);

    try {
      const [ordersStatus] = await verifyConn.query("SHOW COLUMNS FROM orders WHERE Field = 'status'");
      console.log('orders.status column:', ordersStatus[0]?.Type);

      const [orderItemsStatus] = await verifyConn.query("SHOW COLUMNS FROM order_items WHERE Field = 'delivery_status'");
      console.log('order_items.delivery_status column:', orderItemsStatus[0]?.Type || 'NOT FOUND');
    } catch (err) {
      console.error('Verification error:', err.message);
    }

    await verifyConn.end();
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});