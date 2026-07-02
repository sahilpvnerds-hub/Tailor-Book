import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { customers, invoices, notifications } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth";
import { getParam } from "../lib/params";

const router: IRouter = Router();
router.use(authMiddleware);

function ensureOwnership(req: Request, tailorId: string) {
  if (req.user!.role === "admin") return true;
  return tailorId === req.user!.id;
}

// ---- GET /api/notifications ---------------------------------------------
router.get("/", async (req: Request, res: Response) => {
  const conditions =
    req.user!.role === "admin"
      ? undefined
      : eq(notifications.tailorId, req.user!.id);
  const rows = await db
    .select()
    .from(notifications)
    .where(conditions)
    .orderBy(desc(notifications.createdAt));
  res.json(rows);
});

// ---- POST /api/notifications --------------------------------------------
const createSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  type: z.enum([
    "delivery_due_today",
    "delivery_due_tomorrow",
    "delivery_overdue",
    "pending_invoice",
    "general",
    "whatsapp_due",
  ]).default("general"),
  relatedId: z.string().nullable().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const id = crypto.randomUUID();
  await db.insert(notifications).values({
    id,
    tailorId: req.user!.id,
    title: body.data.title,
    message: body.data.message,
    type: body.data.type,
    relatedId: body.data.relatedId ?? null,
  });
  const [row] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);
  res.status(201).json(row);
});

// ---- POST /api/notifications/dispatch-delivery --------------------------
// Returns a list of "delivery" items (overdue + due today) for the calling
// tailor with the WhatsApp deep-link and email body pre-built. The mobile
// app opens the WhatsApp / mailto URLs on tap. We do NOT auto-send — the
// tailor confirms the send inside WhatsApp / their email client.
router.post("/dispatch-delivery", async (req: Request, res: Response) => {
  const tailorId = req.user!.id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Pull every pending invoice for this tailor with a deliveryDate in the
  // past 1 day or in the future (covers "due today" and "overdue" — the
  // mobile app filters out anything in the future).
  const dueInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      orderLabel: invoices.orderLabel,
      customerId: invoices.customerId,
      customerName: invoices.customerName,
      customerMobile: invoices.customerMobile,
      deliveryDate: invoices.deliveryDate,
      total: invoices.total,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tailorId, tailorId),
        eq(invoices.status, "pending"),
        ne(invoices.deliveryDate, null as any),
        gte(invoices.deliveryDate, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        lte(invoices.deliveryDate, todayEnd),
      ),
    )
    .orderBy(desc(invoices.deliveryDate));

  // Resolve customer emails (we have customer name + mobile on the invoice,
  // but email lives on the customer record).
  const customerIds = Array.from(new Set(dueInvoices.map((i) => i.customerId)));
  const customerRows =
    customerIds.length === 0
      ? []
      : await db
          .select({ id: customers.id, email: customers.email })
          .from(customers)
          .where(inArray(customers.id, customerIds));
  const emailById = new Map(customerRows.map((c) => [c.id, c.email ?? null]));

  const fmtDate = (d: Date | null) => {
    if (!d) return "";
    return d.toISOString().slice(0, 10).split("-").reverse().join("-");
  };

  const items = dueInvoices
    .filter((inv) => inv.deliveryDate)
    .map((inv) => {
      const d = inv.deliveryDate as unknown as Date;
      const dateStr = fmtDate(d);
      const message =
        `Hello ${inv.customerName},\n\n` +
        `Your order is ready for delivery.\n\n` +
        `Delivery Date:\n${dateStr}\n\n` +
        `Thank you,\nStitchix`;
      const phoneDigits = (inv.customerMobile ?? "").replace(/\D/g, "");
      const whatsappUrl = `whatsapp://send?phone=${phoneDigits ? `91${phoneDigits}` : ""}&text=${encodeURIComponent(message)}`;
      const subject = `Your order is ready — ${inv.orderLabel ?? inv.invoiceNumber}`;
      const customerEmail = emailById.get(inv.customerId) ?? null;
      const mailtoUrl = customerEmail
        ? `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
        : null;
      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        orderLabel: inv.orderLabel,
        customerName: inv.customerName,
        customerMobile: inv.customerMobile,
        customerEmail,
        deliveryDate: dateStr,
        whatsappUrl,
        emailSubject: subject,
        emailBody: message,
        mailtoUrl,
      };
    });

  res.json({ items, count: items.length });
});

// ---- PATCH /api/notifications/:id/read ----------------------------------
router.patch("/:id/read", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id));
  const [updated] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);
  res.json(updated);
});

// ---- PATCH /api/notifications/read-all ----------------------------------
router.patch("/read-all", async (req: Request, res: Response) => {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      req.user!.role === "admin"
        ? undefined
        : eq(notifications.tailorId, req.user!.id),
    );
  res.json({ ok: true });
});

// ---- DELETE /api/notifications/clear-all --------------------------------
router.delete("/clear-all", async (req: Request, res: Response) => {
  await db
    .delete(notifications)
    .where(
      req.user!.role === "admin"
        ? undefined
        : eq(notifications.tailorId, req.user!.id),
    );
  res.json({ ok: true });
});

// ---- DELETE /api/notifications/:id --------------------------------------
router.delete("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(notifications).where(eq(notifications.id, id));
  res.json({ ok: true });
});

export default router;
