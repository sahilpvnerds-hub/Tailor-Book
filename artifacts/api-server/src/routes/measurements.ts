import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { measurements, customers } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth";
import { getParam } from "../lib/params";

const router: IRouter = Router();
router.use(authMiddleware);

function ensureOwnership(req: Request, tailorId: string) {
  if (req.user!.role === "admin") return true;
  return tailorId === req.user!.id;
}

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v))
  .nullable()
  .optional();

const customMeasurementSchema = z
  .array(z.object({ label: z.string(), value: z.number() }))
  .optional()
  .default([]);

const createSchema = z.object({
  customerId: z.string().min(1),
  productType: z.string().min(1),
  measurementDate: z.string().optional(),
  chest: decimalString,
  shoulder: decimalString,
  neck: decimalString,
  sleeve: decimalString,
  waist: decimalString,
  length: decimalString,
  hip: decimalString,
  thigh: decimalString,
  pantLength: decimalString,
  bottomWidth: decimalString,
  armhole: decimalString,
  wrist: decimalString,
  customMeasurements: customMeasurementSchema,
  notes: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

// ---- GET /api/measurements -------------------------------------------------
router.get("/", async (req: Request, res: Response) => {
  const { customerId } = req.query as { customerId?: string };
  const conditions = [];
  if (req.user!.role !== "admin") {
    conditions.push(eq(measurements.tailorId, req.user!.id));
  }
  if (customerId) {
    conditions.push(eq(measurements.customerId, customerId));
  }
  const rows = await db
    .select()
    .from(measurements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(measurements.measurementDate), desc(measurements.createdAt));
  res.json(rows);
});

// ---- GET /api/measurements/latest ----------------------------------------
router.get("/latest", async (req: Request, res: Response) => {
  const { customerId, productType } = req.query as {
    customerId?: string;
    productType?: string;
  };
  if (!customerId || !productType) {
    res.status(400).json({ error: "customerId and productType are required" });
    return;
  }
  const conditions = [
    eq(measurements.customerId, customerId),
    eq(measurements.productType, productType),
  ];
  if (req.user!.role !== "admin") {
    conditions.push(eq(measurements.tailorId, req.user!.id));
  }
  const [latest] = await db
    .select()
    .from(measurements)
    .where(and(...conditions))
    .orderBy(desc(measurements.measurementDate), desc(measurements.createdAt))
    .limit(1);
  if (!latest) {
    res.status(404).json({ error: "No measurement found" });
    return;
  }
  res.json(latest);
});

// ---- GET /api/measurements/:id --------------------------------------------
router.get("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [m] = await db
    .select()
    .from(measurements)
    .where(eq(measurements.id, id))
    .limit(1);
  if (!m) {
    res.status(404).json({ error: "Measurement not found" });
    return;
  }
  if (!ensureOwnership(req, m.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(m);
});

// ---- POST /api/measurements -----------------------------------------------
router.post("/", async (req: Request, res: Response) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", issues: body.error.issues });
    return;
  }
  const d = body.data;

  const [cust] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, d.customerId))
    .limit(1);
  if (!cust) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  if (!ensureOwnership(req, cust.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = crypto.randomUUID();
  const dateStr = d.measurementDate ?? new Date().toISOString().slice(0, 10);
  await db.insert(measurements).values({
    id,
    customerId: d.customerId,
    tailorId: req.user!.id,
    customerName: cust.name,
    productType: d.productType,
    measurementDate: new Date(dateStr),
    chest: d.chest ?? null,
    shoulder: d.shoulder ?? null,
    neck: d.neck ?? null,
    sleeve: d.sleeve ?? null,
    waist: d.waist ?? null,
    length: d.length ?? null,
    hip: d.hip ?? null,
    thigh: d.thigh ?? null,
    pantLength: d.pantLength ?? null,
    bottomWidth: d.bottomWidth ?? null,
    armhole: d.armhole ?? null,
    wrist: d.wrist ?? null,
    customMeasurements: d.customMeasurements ?? [],
    notes: d.notes ?? null,
  });

  const [m] = await db
    .select()
    .from(measurements)
    .where(eq(measurements.id, id))
    .limit(1);
  res.status(201).json(m);
});

// ---- PATCH /api/measurements/:id -----------------------------------------
router.patch("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(measurements)
    .where(eq(measurements.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Measurement not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = updateSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  // Drizzle expects Date for date columns; convert if a string was supplied.
  const patch: Record<string, unknown> = { ...body.data };
  if (typeof patch.measurementDate === "string") {
    patch.measurementDate = new Date(patch.measurementDate);
  }
  await db.update(measurements).set(patch as any).where(eq(measurements.id, id));
  const [updated] = await db
    .select()
    .from(measurements)
    .where(eq(measurements.id, id))
    .limit(1);
  res.json(updated);
});

// ---- DELETE /api/measurements/:id ----------------------------------------
router.delete("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(measurements)
    .where(eq(measurements.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Measurement not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(measurements).where(eq(measurements.id, id));
  res.json({ ok: true });
});

export default router;
