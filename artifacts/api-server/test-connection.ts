import "dotenv/config";
import * as fs from "node:fs";
import { db } from "@workspace/db";
import { users, customers, measurements, invoices, notifications, productTypes, familyMembers, customMeasurementFields, counters, invoiceItems } from "@workspace/db/schema";
import bcrypt from "bcryptjs";
import { eq, like } from "drizzle-orm";

const out: string[] = [];
const log = (s: string) => out.push(s);

async function check(label: string, fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    log(`✅ ${label}: ${JSON.stringify(r).substring(0, 200)}`);
  } catch (e) {
    log(`❌ ${label}: ${(e as Error).message}`);
  }
}

log("=== DB CONNECTION TEST ===");
await check("SELECT 1", async () => {
  const r = await db.execute<{ ok: number }>("SELECT 1 as ok");
  return r[0];
});

log("");
log("=== AUTHENTICATION ===");
await check("Admin exists (admin@tailorbook.com)", async () => {
  const rows = await db.select().from(users).where(eq(users.email, "admin@tailorbook.com"));
  if (rows.length === 0) return "NOT FOUND";
  const u = rows[0];
  return { name: u.name, role: u.role, status: u.status, pwd_len: u.password.length, pwd_is_bcrypt: u.password.startsWith("$2") };
});

await check("Search 'deep'", async () => {
  const rows = await db.select().from(users).where(like(users.name, "%deep%"));
  return rows.length === 0 ? "NOT FOUND (no user with 'deep' in name)" : rows.map(r => r.name);
});

await check("Search 'patel'", async () => {
  const rows = await db.select().from(users).where(like(users.name, "%patel%"));
  return rows.length === 0 ? "NOT FOUND" : rows.map(r => r.name);
});

await check("Test bcrypt: admin123 against admin hash", async () => {
  const [u] = await db.select().from(users).where(eq(users.email, "admin@tailorbook.com"));
  if (!u) return "no admin";
  const ok = await bcrypt.compare("admin123", u.password);
  return ok ? "✅ MATCH" : "❌ MISMATCH (stored password is not 'admin123')";
});

await check("Test bcrypt: Admin@123 against admin hash", async () => {
  const [u] = await db.select().from(users).where(eq(users.email, "admin@tailorbook.com"));
  if (!u) return "no admin";
  const ok = await bcrypt.compare("Admin@123", u.password);
  return ok ? "✅ MATCH" : "❌ MISMATCH";
});

log("");
log("=== TABLE COUNTS ===");
const tables = [
  ["users", users],
  ["customers", customers],
  ["measurements", measurements],
  ["invoices", invoices],
  ["invoice_items", invoiceItems],
  ["notifications", notifications],
  ["product_types", productTypes],
  ["family_members", familyMembers],
  ["custom_measurement_fields", customMeasurementFields],
  ["counters", counters],
] as const;
for (const [name, t] of tables) {
  await check(`COUNT ${name}`, async () => (await db.select().from(t)).length);
}

log("");
log("=== V2 NEW COLUMNS EXIST? ===");
await check("users.speciality column", async () => {
  const [u] = await db.select().from(users).limit(1);
  return { speciality: u?.speciality, hasField: "speciality" in (u ?? {}) };
});
await check("users.email_verified_at column", async () => {
  const [u] = await db.select().from(users).limit(1);
  return { emailVerifiedAt: u?.emailVerifiedAt, hasField: "emailVerifiedAt" in (u ?? {}) };
});
await check("customers.gender column", async () => {
  const [c] = await db.select().from(customers).limit(1);
  return { gender: c?.gender, hasField: "gender" in (c ?? {}) };
});
await check("customers.family_id column", async () => {
  const [c] = await db.select().from(customers).limit(1);
  return { familyId: c?.familyId, hasField: "familyId" in (c ?? {}) };
});
await check("measurements.photos column", async () => {
  const [m] = await db.select().from(measurements).limit(1);
  return { photos: m?.photos, hasField: "photos" in (m ?? {}) };
});
await check("measurements.delivery_date column", async () => {
  const [m] = await db.select().from(measurements).limit(1);
  return { deliveryDate: m?.deliveryDate, hasField: "deliveryDate" in (m ?? {}) };
});
await check("invoices.delivery_date column", async () => {
  const [i] = await db.select().from(invoices).limit(1);
  return { deliveryDate: i?.deliveryDate, hasField: "deliveryDate" in (i ?? {}) };
});
await check("invoices.gst columns (should be GONE)", async () => {
  const [i] = await db.select().from(invoices).limit(1);
  return { hasGstRate: "gstRate" in (i ?? {}), hasGstAmount: "gstAmount" in (i ?? {}) };
});

fs.writeFileSync("test-out.log", out.join("\n"));
process.exit(0);
