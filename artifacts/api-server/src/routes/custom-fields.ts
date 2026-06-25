import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { customMeasurementFields } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth";
import { getParam } from "../lib/params";

const router: IRouter = Router();
router.use(authMiddleware);

function ensureOwnership(req: Request, tailorId: string) {
  if (req.user!.role === "admin") return true;
  return tailorId === req.user!.id;
}

// ---- GET /api/custom-fields ---------------------------------------------
router.get("/", async (req: Request, res: Response) => {
  const conditions =
    req.user!.role === "admin"
      ? undefined
      : eq(customMeasurementFields.tailorId, req.user!.id);
  const rows = await db
    .select()
    .from(customMeasurementFields)
    .where(conditions)
    .orderBy(desc(customMeasurementFields.createdAt));
  res.json(rows);
});

// ---- POST /api/custom-fields --------------------------------------------
const createSchema = z.object({
  fieldName: z.string().min(1).max(100),
});

router.post("/", async (req: Request, res: Response) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const id = crypto.randomUUID();
  await db.insert(customMeasurementFields).values({
    id,
    tailorId: req.user!.id,
    fieldName: body.data.fieldName,
  });
  const [row] = await db
    .select()
    .from(customMeasurementFields)
    .where(eq(customMeasurementFields.id, id))
    .limit(1);
  res.status(201).json(row);
});

// ---- DELETE /api/custom-fields/:id --------------------------------------
router.delete("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(customMeasurementFields)
    .where(eq(customMeasurementFields.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Custom field not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Count historical measurements that contain this field name in their
  // custom_measurements JSON. We match by label (field name string) because
  // snapshots store the human-readable label, not the UUID.
  // We do a lightweight JSON_SEARCH check; falls back to 0 on any error.
  let usageCount = 0;
  try {
    const [rows] = await (db as any).$client.query(
      `SELECT COUNT(*) AS cnt FROM measurements
       WHERE JSON_SEARCH(custom_measurements, 'one', ?, NULL, '$[*].label') IS NOT NULL`,
      [existing.fieldName],
    );
    usageCount = Number((rows as any[])[0]?.cnt ?? 0);
  } catch {
    // Non-critical — proceed with deletion even if count fails
  }

  await db.delete(customMeasurementFields).where(eq(customMeasurementFields.id, id));
  res.json({ ok: true, usageCount });
});

export default router;
