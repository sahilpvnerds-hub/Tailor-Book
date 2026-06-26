import { Router, type Request, type Response, type IRouter } from "express";
import { and, desc, eq, inArray, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { orders, orderItems, invoices, invoiceItems, customers, counters, familyMembers, measurements } from "@workspace/db/schema";
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

// ---- GET /api/orders ------------------------------------------------------
router.get("/", async (req: Request, res: Response) => {
  const conditions = [];
  if (req.user!.role !== "admin") {
    conditions.push(eq(orders.tailorId, req.user!.id));
  }
  const { customerId, tailorId } = req.query as { customerId?: string; tailorId?: string };
  if (customerId) conditions.push(eq(orders.customerId, customerId));
  // Admin can filter by tailorId.
  if (tailorId && req.user!.role === "admin") {
    conditions.push(eq(orders.tailorId, tailorId));
  }

  const rows = await db
    .select()
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt));

  if (rows.length === 0) {
    res.json([]);
    return;
  }

  const ids = rows.map((r) => r.id);
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, ids));
  const itemsByOrder = new Map<string, typeof items>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }

  const result = rows.map((r) => ({
    ...r,
    items: itemsByOrder.get(r.id) ?? [],
  }));
  res.json(result);
});

// ---- GET /api/orders/:id --------------------------------------------------
router.get("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!ensureOwnership(req, order.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  res.json({ ...order, items });
});

// ---- POST /api/orders -----------------------------------------------------
const orderItemInputSchema = z.object({
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

const createOrderSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  customerMobile: z.string().min(1),
  deliveryDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  advanceAmount: z.number().nonnegative().default(0),
  items: z.array(orderItemInputSchema).min(1),
});

router.post("/", async (req: Request, res: Response) => {
  const body = createOrderSchema.safeParse(req.body);
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

  const enrichedItems: any[] = [];
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
      if (!measurement || measurement.customerId !== d.customerId) {
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
      if (!member || member.primaryCustomerId !== d.customerId) {
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

  const totalAmount = enrichedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const advancePaid = Math.min(d.advanceAmount ?? 0, totalAmount);
  const balanceDue = totalAmount - advancePaid;

  const orderSeq = await nextCounterValue("order");
  const orderNumber = `ORD ${pad3(orderSeq)}`;
  const id = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(orders).values({
      id,
      orderNumber,
      tailorId: req.user!.id,
      customerId: d.customerId,
      customerName: d.customerName,
      customerMobile: d.customerMobile,
      status: "pending",
      deliveryDate: d.deliveryDate ? new Date(d.deliveryDate) : null,
      notes: d.notes ?? null,
      totalAmount: String(totalAmount),
      advanceAmount: String(advancePaid),
      balanceDue: String(balanceDue),
    });

    for (const it of enrichedItems) {
      await tx.insert(orderItems).values({
        id: crypto.randomUUID(),
        orderId: id,
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
        invoiceId: null,
        deliveryStatus: "pending" as any,
      });
    }
  });

  const [createdOrder] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  res.status(201).json({ ...createdOrder, items });
});

// ---- PATCH /api/orders/:id/status -----------------------------------------
const statusSchema = z.object({
  status: z.enum(["pending", "partially-delivered", "completed", "cancelled"]),
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = statusSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  await (db as any)
    .update(orders)
    .set({ status: body.data.status })
    .where(eq(orders.id, id));

  const [updated] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  res.json({ ...updated, items });
});

// ---- DELETE /api/orders/:id -----------------------------------------------
router.delete("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      // Null out the order reference on every invoice that was generated
      // from this order so the FK doesn't dangle. The invoice itself is
      // kept (with its payment record) — the orderId just becomes null.
      await tx
        .update(invoices)
        .set({ orderId: null })
        .where(eq(invoices.orderId, id));

      // order_items rows are removed automatically by ON DELETE CASCADE
      // on the `fk_order_items_order` constraint. The orders row itself
      // is removed by the delete below.
      await tx.delete(orders).where(eq(orders.id, id));
    });
    res.json({ ok: true });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: e?.message ?? "Failed to delete order" });
  }
});

// ---- POST /api/orders/:id/invoice ----------------------------------------
// Generates an invoice from this order.
// Can specify `familyMemberId` query param:
// - If empty: invoice all uninvoiced items.
// - If 'self': invoice only primary customer's uninvoiced items.
// - If a specific ID: invoice only that family member's uninvoiced items.
// Can additionally specify `itemId` to restrict the invoice to a single
// order item (used by the "Mark as Delivered → bill separate" flow).
router.post("/:id/invoice", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const { familyMemberId, itemId } = req.query as {
    familyMemberId?: string;
    itemId?: string;
  };

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!ensureOwnership(req, order.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Get order items that are not yet invoiced
  let itemsToInvoice = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), isNull(orderItems.invoiceId)));

  if (itemsToInvoice.length === 0) {
    res.status(400).json({ error: "No uninvoiced items in this order" });
    return;
  }

  // Apply filters
  if (itemId) {
    // Single-item invoice (used by "Mark as Delivered → bill separate")
    itemsToInvoice = itemsToInvoice.filter((it) => it.id === itemId);
  } else if (familyMemberId) {
    if (familyMemberId === "self") {
      itemsToInvoice = itemsToInvoice.filter(
        (it) => !it.familyMemberId || it.relation === "self"
      );
    } else {
      itemsToInvoice = itemsToInvoice.filter((it) => it.familyMemberId === familyMemberId);
    }
  }

  if (itemsToInvoice.length === 0) {
    res.status(400).json({ error: "No uninvoiced items found for this filter" });
    return;
  }

  const subtotal = itemsToInvoice.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
  const total = subtotal;

  const invoiceSeq = await nextCounterValue("invoice");
  const invoiceNumber = `INV ${pad3(invoiceSeq)}`;
  // orderLabel must be unique per row — use the invoice number so that
  // multiple invoices generated from the same order don't collide.
  const orderLabel = invoiceNumber;
  const invoiceId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // 1. Create the invoice
    await tx.insert(invoices).values({
      id: invoiceId,
      invoiceNumber,
      orderLabel,
      orderId: order.id,
      tailorId: req.user!.id,
      customerId: order.customerId,
      customerName: order.customerName,
      customerMobile: order.customerMobile,
      subtotal: String(subtotal),
      total: String(total),
      // Carry advance from the order only when billing the whole order (no member filter)
      paidAmount: familyMemberId ? "0" : String(order.advanceAmount ?? "0"),
      status: "pending",
      deliveryDate: order.deliveryDate,
      notes: order.notes,
    });

    // 2. Add invoice items and update order items link
    for (let i = 0; i < itemsToInvoice.length; i++) {
      const it = itemsToInvoice[i];
      await tx.insert(invoiceItems).values({
        id: crypto.randomUUID(),
        invoiceId: invoiceId,
        productTypeId: it.productTypeId ?? null,
        productType: it.productType,
        featureLabel: it.featureLabel,
        quantity: it.quantity,
        price: it.price,
        measurementId: it.measurementId,
        familyMemberId: it.familyMemberId,
        personName: it.personName,
        relation: it.relation,
        measurementValues: it.measurementValues,
        position: i,
      });

      await tx
        .update(orderItems)
        .set({ invoiceId })
        .where(eq(orderItems.id, it.id));
    }
  });

  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

  res.status(201).json({ ...inv, items: items.sort((a, b) => a.position - b.position) });
});

// ---- PATCH /api/orders/items/:id/delivery -------------------------------
// Update delivery status of an order item and auto-calculate order status
router.patch("/items/:id/delivery", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const { deliveryStatus } = req.body as { deliveryStatus: "pending" | "delivered" };

  if (deliveryStatus !== "pending" && deliveryStatus !== "delivered") {
    res.status(400).json({ error: "Invalid delivery status" });
    return;
  }

  // Find the order item
  const [item] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, id))
    .limit(1);

  if (!item) {
    res.status(404).json({ error: "Order item not found" });
    return;
  }

  // Check ownership via the order
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, item.orderId))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (!ensureOwnership(req, order.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Update the item's delivery status
  await (db as any)
    .update(orderItems)
    .set({ deliveryStatus })
    .where(eq(orderItems.id, id));

  // Auto-calculate order status based on item delivery statuses
  const allItems = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const deliveredCount = allItems.filter((it: any) => it.deliveryStatus === "delivered").length;

  let newStatus: "pending" | "partially-delivered" | "completed" | "cancelled";
  if (deliveredCount === 0) {
    newStatus = "pending";
  } else if (deliveredCount === allItems.length) {
    newStatus = "completed";
  } else {
    newStatus = "partially-delivered";
  }

  // Update order status
  await (db as any)
    .update(orders)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  // Return updated item and order
  const [updatedItem] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, id))
    .limit(1);

  res.json({
    item: updatedItem,
    orderStatus: newStatus
  });
});

export default router;
