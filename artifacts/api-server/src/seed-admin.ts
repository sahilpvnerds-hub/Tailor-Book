/**
 * seed-admin.ts
 *
 * Run with:  pnpm --filter @workspace/api-server exec tsx src/seed-admin.ts
 *   or:      npx tsx src/seed-admin.ts
 *
 * Creates / resets the admin user with a proper bcrypt hash.
 * Safe to run multiple times (upserts on email conflict).
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@tailorbook.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
const ADMIN_MOBILE = process.env.ADMIN_MOBILE ?? "9999999999";
const RESET_EXISTING_PASSWORD = process.env.ADMIN_RESET_PASSWORD === "true";

console.log(`[seed-admin] Hashing password for ${ADMIN_EMAIL}…`);
const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

const existing = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, ADMIN_EMAIL))
  .limit(1);

if (existing.length > 0) {
  const updates: Partial<typeof users.$inferInsert> = {
    status: "approved",
    role: "admin",
    onboardingComplete: true,
    emailVerifiedAt: new Date(),
  };
  if (RESET_EXISTING_PASSWORD) {
    updates.password = hashed;
  }

  await db
    .update(users)
    .set(updates)
    .where(eq(users.email, ADMIN_EMAIL));
  console.log(`[seed-admin] ✅ Updated existing admin: ${ADMIN_EMAIL}`);
} else {
  await db.insert(users).values({
    id:                 crypto.randomUUID(),
    name:               "Admin",
    email:              ADMIN_EMAIL,
    mobile:             ADMIN_MOBILE,
    password:           hashed,
    role:               "admin",
    status:             "approved",
    emailVerifiedAt:    new Date(),
    onboardingComplete: true,
  });
  console.log(`[seed-admin] ✅ Created admin user: ${ADMIN_EMAIL}`);
}

console.log(`[seed-admin] Password: ${ADMIN_PASSWORD}`);
process.exit(0);
