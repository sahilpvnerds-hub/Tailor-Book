import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./index";

async function run() {
  console.log("Applying orders migration...");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sqlFile = path.resolve(__dirname, "../../../db/migrate_orders.sql");
  const sql = fs.readFileSync(sqlFile, "utf8");

  // Split statements by semicolon
  const rawStatements = sql.split(";");

  const conn = await pool.getConnection();
  try {
    for (const stmt of rawStatements) {
      // Remove SQL comments
      const cleanStmt = stmt
        .replace(/--.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();

      if (!cleanStmt) continue;
      if (cleanStmt.toUpperCase().startsWith("USE ")) continue;

      console.log(`Executing statement: ${cleanStmt.substring(0, 80).replace(/\n/g, " ")}...`);
      try {
        await conn.query(cleanStmt);
      } catch (err: any) {
        // Ignore duplicate column name (1060) or duplicate key name (1061) or table already exists (1050)
        if (err.errno === 1060 || err.errno === 1061 || err.errno === 1050) {
          console.warn(`[Ignored Warning] statement already applied: ${err.sqlMessage}`);
        } else {
          throw err;
        }
      }
    }
    console.log("Migration executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
