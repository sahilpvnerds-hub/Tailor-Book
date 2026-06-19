import { db } from "@workspace/db";
import { pendingOtps } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const [latest] = await db
  .select()
  .from(pendingOtps)
  .orderBy(desc(pendingOtps.createdAt))
  .limit(1);

if (!latest) { console.log("No OTP records"); process.exit(0); }
console.log(JSON.stringify(latest, null, 2));
