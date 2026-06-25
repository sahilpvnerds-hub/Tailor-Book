import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./index";

async function run() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrations = [
    { name: "orders migration", file: "../../../db/migrate_orders.sql" },
    { name: "features migration", file: "../../../db/migrate_features.sql" },
    { name: "cascade deletes migration", file: "../../../db/migrate_cascade_deletes.sql" }
  ];

  const conn = await pool.getConnection();
  try {
    for (const migration of migrations) {
      console.log(`Applying ${migration.name}...`);
      const sqlFile = path.resolve(__dirname, migration.file);
      if (!fs.existsSync(sqlFile)) {
        console.warn(`Migration file not found: ${sqlFile}`);
        continue;
      }
      const sql = fs.readFileSync(sqlFile, "utf8");

      // Split statements by semicolon
      const rawStatements = sql.split(";");

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
          // Ignore duplicate column name (1060), duplicate key name (1061), table already exists (1050),
          // or key/column/foreign key doesn't exist when dropping (1091, 1025)
          if (
            err.errno === 1060 ||
            err.errno === 1061 ||
            err.errno === 1050 ||
            err.errno === 1091 ||
            err.errno === 1025
          ) {
            console.warn(`[Ignored Warning] statement already applied/redundant: ${err.sqlMessage}`);
          } else {
            throw err;
          }
        }
      }
      console.log(`${migration.name} executed successfully!`);
    }
    console.log("All migrations executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();

