const mysql = require("mysql2/promise");
require("dotenv").config({ path: require("path").resolve(__dirname, "../api-server/.env") });

async function main() {
  const connectionString = process.env.DATABASE_URL || "mysql://root:admin123@localhost:3306/tailorbook";
  const pool = mysql.createPool(connectionString);

  try {
    console.log("Checking columns in invoices...");
    const [invCols] = await pool.query("SHOW COLUMNS FROM invoices");
    if (!invCols.find(c => c.Field === "paid_amount")) {
      console.log("Adding paid_amount to invoices...");
      await pool.query("ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT '0'");
    } else {
      console.log("paid_amount already exists in invoices.");
    }

    console.log("Checking columns in orders...");
    const [ordCols] = await pool.query("SHOW COLUMNS FROM orders");
    if (!ordCols.find(c => c.Field === "paid_amount")) {
      console.log("Adding paid_amount to orders...");
      await pool.query("ALTER TABLE orders ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT '0'");
    } else {
      console.log("paid_amount already exists in orders.");
    }

    console.log("Adding paid_amount to db/schema.sql...");
    const fs = require("fs");
    const path = require("path");
    const schemaPath = path.resolve(__dirname, "../db/schema.sql");
    let schemaStr = fs.readFileSync(schemaPath, "utf-8");
    if (!schemaStr.includes("paid_amount")) {
      schemaStr = schemaStr.replace("total            DECIMAL(12,2) NOT NULL DEFAULT 0,", "total            DECIMAL(12,2) NOT NULL DEFAULT 0,\n  paid_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,");
      fs.writeFileSync(schemaPath, schemaStr);
      console.log("Updated schema.sql with paid_amount column.");
    }

    console.log("Done.");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
