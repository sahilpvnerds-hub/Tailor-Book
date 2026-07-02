import { db, invoices } from "./src/schema/index.js";
import { eq } from "drizzle-orm";
import { pool } from "./src/index.js";

async function main() {
  const allInvoices = await db.select().from(invoices).limit(2);
  console.log(allInvoices);
  await pool.end();
}
main();
