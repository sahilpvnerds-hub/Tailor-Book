import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  customers,
  familyMembers,
  measurementItems,
  measurementSessions,
  measurementValues,
  measurements,
  productTypes,
} from "@workspace/db/schema";
import { orders, orderItems } from "@workspace/db/schema";
import { invoices, invoiceItems } from "@workspace/db/schema";
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

const standardMeasurementFields = [
  "chest",
  "shoulder",
  "neck",
  "sleeve",
  "waist",
  "length",
  "hip",
  "thigh",
  "pantLength",
  "bottomWidth",
  "armhole",
  "wrist",
] as const;

const measurementValuesSchema = z
  .record(z.string(), decimalString)
  .optional()
  .default({});

const measurementItemSchema = z.object({
  productTypeId: z.string().nullable().optional(),
  productType: z.string().min(1),
  featureLabel: z.string().nullable().optional(),
  values: measurementValuesSchema,
  customMeasurements: customMeasurementSchema,
  notes: z.string().nullable().optional(),
  photos: z.array(z.string()).optional().default([]),
});

const createSchema = z.object({
  customerId: z.string().min(1),
  familyMemberId: z.string().nullable().optional(),
  productType: z.string().min(1).optional(),
  productTypeId: z.string().nullable().optional(),
  featureLabel: z.string().nullable().optional(),
  measurementDate: z.string().optional(),
  date: z.string().optional(),
  deliveryDate: z.string().nullable().optional(),
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
  photos: z.array(z.string()).optional().default([]),
  items: z.array(measurementItemSchema).optional(),
});

const updateSchema = createSchema.partial();

type ParsedCreate = z.infer<typeof createSchema>;
type NormalizedItem = z.infer<typeof measurementItemSchema>;

function toDateOnly(raw?: string | null) {
  if (!raw) return undefined;
  return raw.slice(0, 10);
}

function getPositiveNumber(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(value);
}

function normalizeItems(d: ParsedCreate): NormalizedItem[] {
  if (d.items?.length) return d.items;
  const values: Record<string, string | null | undefined> = {};
  for (const key of standardMeasurementFields) {
    values[key] = d[key];
  }
  return [
    {
      productTypeId: d.productTypeId,
      productType: d.productType ?? "",
      featureLabel: d.featureLabel,
      values,
      customMeasurements: d.customMeasurements ?? [],
      notes: d.notes,
      photos: d.photos ?? [],
    },
  ];
}

async function loadSessionDetail(sessionId: string) {
  const [session] = await db
    .select({
      id: measurementSessions.id,
      customerId: measurementSessions.customerId,
      familyMemberId: measurementSessions.familyMemberId,
      tailorId: measurementSessions.tailorId,
      measurementDate: measurementSessions.measurementDate,
      deliveryDate: measurementSessions.deliveryDate,
      notes: measurementSessions.notes,
      photos: measurementSessions.photos,
      createdBy: measurementSessions.createdBy,
      createdAt: measurementSessions.createdAt,
      updatedAt: measurementSessions.updatedAt,
    })
    .from(measurementSessions)
    .where(eq(measurementSessions.id, sessionId))
    .limit(1);
  if (!session) return null;

  const items = await db
    .select()
    .from(measurementItems)
    .where(eq(measurementItems.measurementSessionId, sessionId));

  const itemsWithValues = [];
  for (const item of items) {
    const values = await db
      .select()
      .from(measurementValues)
      .where(eq(measurementValues.measurementItemId, item.id));
    itemsWithValues.push({ ...item, values });
  }

  return { ...session, items: itemsWithValues };
}

// ---- GET /api/measurements -------------------------------------------------
// Exclude photos from list view to avoid MySQL "Out of sort memory" error
// when sorting large photo payloads. Use GET /:id to fetch full details with photos.
router.get("/", async (req: Request, res: Response) => {
  const { customerId, familyMemberId } = req.query as { customerId?: string; familyMemberId?: string };
  const conditions = [];
  if (req.user!.role !== "admin") {
    conditions.push(eq(measurements.tailorId, req.user!.id));
  }
  if (customerId) {
    conditions.push(eq(measurements.customerId, customerId));
  }
  if (familyMemberId) {
    conditions.push(eq(measurements.familyMemberId, familyMemberId));
  }
  const rows = await db
    .select({
      id: measurements.id,
      customerId: measurements.customerId,
      familyMemberId: measurements.familyMemberId,
      measurementSessionId: measurements.measurementSessionId,
      tailorId: measurements.tailorId,
      customerName: measurements.customerName,
      productType: measurements.productType,
      featureLabel: measurements.featureLabel,
      measurementDate: measurements.measurementDate,
      deliveryDate: measurements.deliveryDate,
      chest: measurements.chest,
      shoulder: measurements.shoulder,
      neck: measurements.neck,
      sleeve: measurements.sleeve,
      waist: measurements.waist,
      length: measurements.length,
      hip: measurements.hip,
      thigh: measurements.thigh,
      pantLength: measurements.pantLength,
      bottomWidth: measurements.bottomWidth,
      armhole: measurements.armhole,
      wrist: measurements.wrist,
      customMeasurements: measurements.customMeasurements,
      notes: measurements.notes,
      createdAt: measurements.createdAt,
      updatedAt: measurements.updatedAt,
    })
    .from(measurements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(measurements.measurementDate), desc(measurements.createdAt));
  res.json(rows);
});

// ---- GET /api/measurements/latest ----------------------------------------
// Exclude photos from list view to avoid MySQL "Out of sort memory" error
router.get("/latest", async (req: Request, res: Response) => {
  const { customerId, familyMemberId, productType } = req.query as {
    customerId?: string;
    familyMemberId?: string;
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
  if (familyMemberId) {
    conditions.push(eq(measurements.familyMemberId, familyMemberId));
  }
  const [latest] = await db
    .select({
      id: measurements.id,
      customerId: measurements.customerId,
      familyMemberId: measurements.familyMemberId,
      measurementSessionId: measurements.measurementSessionId,
      tailorId: measurements.tailorId,
      customerName: measurements.customerName,
      productType: measurements.productType,
      featureLabel: measurements.featureLabel,
      measurementDate: measurements.measurementDate,
      deliveryDate: measurements.deliveryDate,
      chest: measurements.chest,
      shoulder: measurements.shoulder,
      neck: measurements.neck,
      sleeve: measurements.sleeve,
      waist: measurements.waist,
      length: measurements.length,
      hip: measurements.hip,
      thigh: measurements.thigh,
      pantLength: measurements.pantLength,
      bottomWidth: measurements.bottomWidth,
      armhole: measurements.armhole,
      wrist: measurements.wrist,
      customMeasurements: measurements.customMeasurements,
      notes: measurements.notes,
      createdAt: measurements.createdAt,
      updatedAt: measurements.updatedAt,
    })
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

// ---- GET /api/measurements/sessions --------------------------------------
// Exclude photos from list view to avoid MySQL "Out of sort memory" error
router.get("/sessions", async (req: Request, res: Response) => {
  const { customerId, familyMemberId } = req.query as { customerId?: string; familyMemberId?: string };
  const conditions = [];
  if (req.user!.role !== "admin") {
    conditions.push(eq(measurementSessions.tailorId, req.user!.id));
  }
  if (customerId) {
    conditions.push(eq(measurementSessions.customerId, customerId));
  }
  if (familyMemberId) {
    conditions.push(eq(measurementSessions.familyMemberId, familyMemberId));
  }
  const rows = await db
    .select({
      id: measurementSessions.id,
      customerId: measurementSessions.customerId,
      familyMemberId: measurementSessions.familyMemberId,
      tailorId: measurementSessions.tailorId,
      measurementDate: measurementSessions.measurementDate,
      deliveryDate: measurementSessions.deliveryDate,
      notes: measurementSessions.notes,
      createdBy: measurementSessions.createdBy,
      createdAt: measurementSessions.createdAt,
      updatedAt: measurementSessions.updatedAt,
    })
    .from(measurementSessions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(measurementSessions.measurementDate), desc(measurementSessions.createdAt));
  res.json(rows);
});

// ---- GET /api/measurements/sessions/:id ----------------------------------
router.get("/sessions/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const detail = await loadSessionDetail(id);
  if (!detail) {
    res.status(404).json({ error: "Measurement session not found" });
    return;
  }
  if (!ensureOwnership(req, detail.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(detail);
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
  const items = normalizeItems(d);
  if (items.length === 0) {
    res.status(400).json({ error: "At least one product is required" });
    return;
  }

  const invalidProduct = items.find((item) => !item.productType.trim());
  if (invalidProduct) {
    res.status(400).json({ error: "Every product must have a product type" });
    return;
  }

  for (const [idx, item] of items.entries()) {
    const hasValue =
      Object.values(item.values).some((value) => getPositiveNumber(value) !== null) ||
      item.customMeasurements.some((m) => m.value > 0);
    if (!hasValue) {
      res.status(400).json({
        error: `Product ${idx + 1} (${item.productType}) must include at least one valid measurement`,
      });
      return;
    }
  }

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

  if (d.familyMemberId) {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, d.familyMemberId))
      .limit(1);
    if (!member || member.primaryCustomerId !== d.customerId) {
      res.status(400).json({ error: "Family member does not belong to this customer" });
      return;
    }
    if (!ensureOwnership(req, member.tailorId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  // Note: Product type validation is intentionally skipped here because
  // measurements can be created during order creation before the product
  // type is saved to the database. The validation happens at order creation time.

  const sessionId = crypto.randomUUID();
  const dateStr = toDateOnly(d.measurementDate ?? d.date) ?? new Date().toISOString().slice(0, 10);

  // Timezone-safe past-date limit (24 hours grace)
  const graceLimit = new Date();
  graceLimit.setHours(0, 0, 0, 0);
  graceLimit.setDate(graceLimit.getDate() - 1);

  if (new Date(dateStr).getTime() < graceLimit.getTime()) {
    res.status(400).json({ error: "Measurement Date cannot be in the past" });
    return;
  }

  if (d.deliveryDate && new Date(d.deliveryDate).getTime() < graceLimit.getTime()) {
    res.status(400).json({ error: "Delivery Date cannot be in the past" });
    return;
  }
  const createdMeasurementIds = await db.transaction(async (tx) => {
    await tx.insert(measurementSessions).values({
      id: sessionId,
      customerId: d.customerId,
      familyMemberId: d.familyMemberId ?? null,
      tailorId: req.user!.id,
      measurementDate: new Date(dateStr),
      deliveryDate: d.deliveryDate ? new Date(toDateOnly(d.deliveryDate)!) : null,
      notes: d.notes ?? null,
      photos: d.photos ?? [],
      createdBy: req.user!.id,
    });

    const legacyIds: string[] = [];
    for (const item of items) {
      const itemId = crypto.randomUUID();
      await tx.insert(measurementItems).values({
        id: itemId,
        measurementSessionId: sessionId,
        productTypeId: item.productTypeId ?? null,
        productType: item.productType,
        featureLabel: item.featureLabel ?? null,
      });

      const normalizedValues = Object.entries(item.values)
        .map(([fieldName, fieldValue]) => ({ fieldName, fieldValue: getPositiveNumber(fieldValue) }))
        .filter((value): value is { fieldName: string; fieldValue: string } => value.fieldValue !== null);

      const customValues = item.customMeasurements
        .filter((m) => m.value > 0)
        .map((m) => ({ fieldName: m.label, fieldValue: String(m.value) }));

      const allValues = [...normalizedValues, ...customValues];
      if (allValues.length > 0) {
        await tx.insert(measurementValues).values(
          allValues.map((value) => ({
            id: crypto.randomUUID(),
            measurementItemId: itemId,
            fieldName: value.fieldName,
            fieldValue: value.fieldValue,
          }))
        );
      }

      const legacyId = crypto.randomUUID();
      legacyIds.push(legacyId);
      await tx.insert(measurements).values({
        id: legacyId,
        customerId: d.customerId,
        familyMemberId: d.familyMemberId ?? null,
        measurementSessionId: sessionId,
        tailorId: req.user!.id,
        customerName: cust.name,
        productType: item.productType,
        featureLabel: item.featureLabel ?? null,
        measurementDate: new Date(dateStr),
        deliveryDate: d.deliveryDate ? new Date(toDateOnly(d.deliveryDate)!) : null,
        chest: getPositiveNumber(item.values.chest),
        shoulder: getPositiveNumber(item.values.shoulder),
        neck: getPositiveNumber(item.values.neck),
        sleeve: getPositiveNumber(item.values.sleeve),
        waist: getPositiveNumber(item.values.waist),
        length: getPositiveNumber(item.values.length),
        hip: getPositiveNumber(item.values.hip),
        thigh: getPositiveNumber(item.values.thigh),
        pantLength: getPositiveNumber(item.values.pantLength),
        bottomWidth: getPositiveNumber(item.values.bottomWidth),
        armhole: getPositiveNumber(item.values.armhole),
        wrist: getPositiveNumber(item.values.wrist),
        customMeasurements: item.customMeasurements ?? [],
        notes: item.notes ?? d.notes ?? null,
        photos: item.photos?.length ? item.photos : d.photos ?? [],
      });
    }
    return legacyIds;
  });

  const created = await db
    .select()
    .from(measurements)
    .where(eq(measurements.measurementSessionId, sessionId));

  if (!d.items || createdMeasurementIds.length === 1) {
    res.status(200).json(created[0]);
    return;
  }

  const session = await loadSessionDetail(sessionId);
  res.status(200).json({ ...session, measurements: created });
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
  if (typeof patch.deliveryDate === "string") {
    patch.deliveryDate = new Date(patch.deliveryDate);
  }

  // Timezone-safe past-date limit (24 hours grace)
  const graceLimit = new Date();
  graceLimit.setHours(0, 0, 0, 0);
  graceLimit.setDate(graceLimit.getDate() - 1);

  if (patch.measurementDate instanceof Date) {
    if (patch.measurementDate.getTime() < graceLimit.getTime()) {
      res.status(400).json({ error: "Measurement Date cannot be in the past" });
      return;
    }
  }

  if (patch.deliveryDate instanceof Date) {
    if (patch.deliveryDate.getTime() < graceLimit.getTime()) {
      res.status(400).json({ error: "Delivery Date cannot be in the past" });
      return;
    }
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
// Refuse the delete if any order or invoice item still references the
// measurement. The mobile app expects a `{ ok: false, references }`
// payload here so it can surface the offending numbers.
async function getMeasurementReferences(id: string) {
  const orderRefs = await db
    .select({ orderNumber: orders.orderNumber })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(eq(orderItems.measurementId, id));
  const invoiceRefs = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .where(eq(invoiceItems.measurementId, id));
  return {
    orders: orderRefs.map((r) => r.orderNumber),
    invoices: invoiceRefs.map((r) => r.invoiceNumber),
  };
}

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
  const references = await getMeasurementReferences(id);
  if (references.orders.length > 0 || references.invoices.length > 0) {
    res.status(409).json({
      ok: false,
      error: "Measurement is referenced by orders or invoices",
      references,
    });
    return;
  }
  await db.delete(measurements).where(eq(measurements.id, id));
  res.json({ ok: true });
});

export default router;
