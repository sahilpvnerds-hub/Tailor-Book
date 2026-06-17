import "dotenv/config";
import { db } from "@workspace/db";
import {
  users,
  customers,
  measurements,
  invoices,
  notifications,
  productTypes,
  familyMembers,
  customMeasurementFields,
} from "@workspace/db/schema";
import * as fs from "node:fs";

const out: string[] = [];
const log = (s: string) => out.push(s);

try {
  const userRows = await db.select().from(users);
  const customerRows = await db.select().from(customers);
  const mRows = await db.select().from(measurements);
  const invRows = await db.select().from(invoices);
  const notifRows = await db.select().from(notifications);
  const ptRows = await db.select().from(productTypes);
  const fmRows = await db.select().from(familyMembers);
  const cfRows = await db.select().from(customMeasurementFields);

  log(`users: ${userRows.length}`);
  log(`customers: ${customerRows.length}`);
  log(`measurements: ${mRows.length}`);
  log(`invoices: ${invRows.length}`);
  log(`notifications: ${notifRows.length}`);
  log(`product_types: ${ptRows.length}`);
  log(`family_members: ${fmRows.length}`);
  log(`custom_measurement_fields: ${cfRows.length}`);
  log(`---`);
  for (const u of userRows) {
    log(
      JSON.stringify({
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
        status: u.status,
        speciality: u.speciality,
        pwd_len: u.password?.length,
        pwd_is_bcrypt: u.password?.startsWith("$2"),
        pwd_prefix: u.password?.substring(0, 4),
        onboard: u.onboardingComplete,
        created: u.createdAt,
      }),
    );
  }
} catch (e) {
  log("ERR: " + (e as Error).message);
  log((e as Error).stack ?? "");
}

fs.writeFileSync("inspect.out", out.join("\n"));
process.exit(0);
