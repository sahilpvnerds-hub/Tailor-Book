import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { invoices, invoiceItems, customers, counters, familyMembers, measurements } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth";
import { getParam } from "../lib/params";

const router: IRouter = Router();
router.use(authMiddleware);

function ensureOwnership(req: Request, tailorId: string) {
  if (req.user!.role === "admin") return true;
  return tailorId === req.user!.id;
}

async function nextCounterValue(name: string): Promise<number> {
  const existing = await db.select().from(counters).where(eq(counters.name, name)).limit(1);
  if (existing.length === 0) {
    await db.insert(counters).values({ name, value: 1 });
    return 1;
  }
  await db
    .update(counters)
    .set({ value: sql`${counters.value} + 1` })
    .where(eq(counters.name, name));
  const [row] = await db.select().from(counters).where(eq(counters.name, name)).limit(1);
  return row.value;
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

// ---- GET /api/invoices ----------------------------------------------------
router.get("/", async (req: Request, res: Response) => {
  const conditions = [];
  if (req.user!.role !== "admin") {
    conditions.push(eq(invoices.tailorId, req.user!.id));
  }
  const { customerId, tailorId } = req.query as { customerId?: string; tailorId?: string };
  if (customerId) conditions.push(eq(invoices.customerId, customerId));
  // Admin can filter by tailorId.
  if (tailorId && req.user!.role === "admin") {
    conditions.push(eq(invoices.tailorId, tailorId));
  }

  const rows = await db
    .select()
    .from(invoices)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(invoices.createdAt));

  if (rows.length === 0) {
    res.json([]);
    return;
  }
  const ids = rows.map((r) => r.id);
  const items = await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, ids));
  const itemsByInvoice = new Map<string, typeof items>();
  for (const it of items) {
    const arr = itemsByInvoice.get(it.invoiceId) ?? [];
    arr.push(it);
    itemsByInvoice.set(it.invoiceId, arr);
  }
  const result = rows.map((r) => ({
    ...r,
    items: (itemsByInvoice.get(r.id) ?? []).sort((a, b) => a.position - b.position),
  }));
  res.json(result);
});

// ---- GET /api/invoices/:id ------------------------------------------------
router.get("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [inv] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!inv) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (!ensureOwnership(req, inv.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, inv.id));
  res.json({ ...inv, items: items.sort((a, b) => a.position - b.position) });
});

// ---- POST /api/invoices ---------------------------------------------------
const itemSchema = z.object({
  productTypeId: z.string().nullable().optional(),
  productType: z.string().min(1),
  featureLabel: z.string().nullable().optional(),
  quantity: z.number().int().positive().default(1),
  price: z.number().nonnegative().default(0),
  measurementId: z.string().nullable().optional(),
  familyMemberId: z.string().nullable().optional(),
  personName: z.string().nullable().optional(),
  relation: z.string().nullable().optional(),
  measurementValues: z.record(z.string(), z.string()).nullable().optional(),
});
type InvoiceInputItem = z.infer<typeof itemSchema>;
type EnrichedInvoiceItem = InvoiceInputItem & {
  familyMemberId: string | null;
  personName: string;
  relation: string;
};

const createSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  customerMobile: z.string().min(1),
  deliveryDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1),
});

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

  const enrichedItems: EnrichedInvoiceItem[] = [];
  for (const item of d.items) {
    let familyMemberId = item.familyMemberId ?? null;
    let personName = item.personName ?? null;
    let relation = item.relation ?? null;

    if (item.measurementId && (!personName || !relation)) {
      const [measurement] = await db
        .select()
        .from(measurements)
        .where(eq(measurements.id, item.measurementId))
        .limit(1);
      if (!measurement || measurement.customerId !== d.customerId || !ensureOwnership(req, measurement.tailorId)) {
        res.status(400).json({ error: `Invalid measurement for ${item.productType}` });
        return;
      }
      familyMemberId = familyMemberId ?? measurement.familyMemberId ?? null;
    }

    if (familyMemberId) {
      const [member] = await db
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.id, familyMemberId))
        .limit(1);
      if (!member || member.primaryCustomerId !== d.customerId || !ensureOwnership(req, member.tailorId)) {
        res.status(400).json({ error: `Invalid family member for ${item.productType}` });
        return;
      }
      personName = member.name;
      relation = member.relation;
    } else {
      personName = personName ?? cust.name;
      relation = relation ?? "self";
    }

    enrichedItems.push({ ...item, familyMemberId, personName, relation });
  }

  const subtotal = enrichedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal;

  const invoiceSeq = await nextCounterValue("invoice");
  const orderSeq = await nextCounterValue("order");
  const invoiceNumber = `INV ${pad3(invoiceSeq)}`;
  const orderLabel = `ORD ${pad3(orderSeq)}`;
  const id = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id,
      invoiceNumber,
      orderLabel,
      orderId: d.orderId ?? null,
      tailorId: req.user!.id,
      customerId: d.customerId,
      customerName: d.customerName,
      customerMobile: d.customerMobile,
      subtotal: String(subtotal),
      total: String(total),
      status: "pending",
      deliveryDate: d.deliveryDate ? new Date(d.deliveryDate) : null,
      notes: d.notes ?? null,
    });

    for (let i = 0; i < enrichedItems.length; i++) {
      const it = enrichedItems[i];
      await tx.insert(invoiceItems).values({
        id: crypto.randomUUID(),
        invoiceId: id,
        productTypeId: it.productTypeId ?? null,
        productType: it.productType,
        featureLabel: it.featureLabel ?? null,
        quantity: it.quantity,
        price: String(it.price),
        measurementId: it.measurementId ?? null,
        familyMemberId: it.familyMemberId ?? null,
        personName: it.personName ?? null,
        relation: it.relation ?? null,
        measurementValues: it.measurementValues ?? null,
        position: i,
      });
    }
  });

  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id));
  res.status(201).json({ ...inv, items: items.sort((a, b) => a.position - b.position) });
});

// ---- PATCH /api/invoices/:id/status --------------------------------------
const statusSchema = z.object({
  status: z.enum(["pending", "completed", "cancelled"]),
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = statusSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  await db
    .update(invoices)
    .set({ status: body.data.status })
    .where(eq(invoices.id, id));
  const [updated] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!updated) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  // Return the full invoice (with items) so the client doesn't have to
  // re-fetch — consistent with GET /api/invoices/:id and POST /api/invoices.
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, updated.id));
  res.json({ ...updated, items: items.sort((a, b) => a.position - b.position) });
});

// ---- DELETE /api/invoices/:id --------------------------------------------
router.delete("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(invoices).where(eq(invoices.id, id));
  res.json({ ok: true });
});

export default router;
