import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, gte, inArray, like, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { users, customers, orders, invoices, adminAuditLog } from "@workspace/db/schema";
import { authMiddleware, adminOnly } from "../middlewares/auth";
import { getParam } from "../lib/params";

const router: IRouter = Router();
router.use(authMiddleware, adminOnly);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function publicUser(u: typeof users.$inferSelect) {
  // Never leak the bcrypt hash to the client.
  const { password: _pw, ...rest } = u;
  return rest;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Record an admin-initiated mutation in the audit log. Lightweight snapshot
 * of before / after — never includes the password hash.
 */
async function recordAudit(
  adminId: string,
  action: "approve" | "reject" | "suspend" | "unsuspend" | "patch" | "delete",
  targetId: string,
  before: typeof users.$inferSelect | null,
  after: typeof users.$inferSelect | null,
) {
  try {
    const strip = (u: typeof users.$inferSelect | null) =>
      u ? (publicUser(u) as Record<string, unknown>) : null;
    await db.insert(adminAuditLog).values({
      id: crypto.randomUUID(),
      adminId,
      action,
      targetType: "user",
      targetId,
      beforeJson: strip(before),
      afterJson: strip(after),
    });
  } catch (err) {
    // Audit failure must NOT block the actual operation — log and move on.
    // eslint-disable-next-line no-console
    console.error("[admin] audit log failed:", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/overview
// Aggregate KPIs for the admin dashboard overview screen.
// ---------------------------------------------------------------------------
router.get("/overview", async (_req: Request, res: Response) => {
  try {
    const monthStart = startOfMonth();

    // Tailors
    const [tailorCounts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        pending: sql<number>`SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)`,
        approved: sql<number>`SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END)`,
        rejected: sql<number>`SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END)`,
        newThisMonth: sql<number>`SUM(CASE WHEN created_at >= ${monthStart} THEN 1 ELSE 0 END)`,
      })
      .from(users)
      .where(eq(users.role, "tailor"));

    // Customers
    const [customerCounts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        newThisMonth: sql<number>`SUM(CASE WHEN created_at >= ${monthStart} THEN 1 ELSE 0 END)`,
      })
      .from(customers);

    // Orders
    const [orderCounts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        inProgress: sql<number>`SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)`,
        delivered: sql<number>`SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END)`,
        newThisMonth: sql<number>`SUM(CASE WHEN created_at >= ${monthStart} THEN 1 ELSE 0 END)`,
      })
      .from(orders);

    // Invoices + revenue
    const [invoiceCounts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        paid: sql<number>`SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END)`,
        unpaid: sql<number>`SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)`,
        revenueThisMonth: sql<string>`COALESCE(SUM(CASE WHEN created_at >= ${monthStart} THEN total ELSE 0 END), 0)`,
        outstanding: sql<string>`COALESCE(SUM(CASE WHEN status='pending' THEN total - paid_amount ELSE 0 END), 0)`,
      })
      .from(invoices);

    res.json({
      tailors: {
        total: Number(tailorCounts?.total ?? 0),
        pending: Number(tailorCounts?.pending ?? 0),
        approved: Number(tailorCounts?.approved ?? 0),
        rejected: Number(tailorCounts?.rejected ?? 0),
        newThisMonth: Number(tailorCounts?.newThisMonth ?? 0),
      },
      customers: {
        total: Number(customerCounts?.total ?? 0),
        newThisMonth: Number(customerCounts?.newThisMonth ?? 0),
      },
      orders: {
        total: Number(orderCounts?.total ?? 0),
        inProgress: Number(orderCounts?.inProgress ?? 0),
        delivered: Number(orderCounts?.delivered ?? 0),
        newThisMonth: Number(orderCounts?.newThisMonth ?? 0),
      },
      invoices: {
        total: Number(invoiceCounts?.total ?? 0),
        paid: Number(invoiceCounts?.paid ?? 0),
        unpaid: Number(invoiceCounts?.unpaid ?? 0),
        revenueThisMonth: Number(invoiceCounts?.revenueThisMonth ?? 0),
        outstanding: Number(invoiceCounts?.outstanding ?? 0),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to compute overview", detail: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/users
// Tailor list with optional search & status filter.
// ---------------------------------------------------------------------------
router.get("/users", async (req: Request, res: Response) => {
  const { status, q, role, withStats } = req.query as {
    status?: string;
    q?: string;
    role?: string;
    withStats?: string;
  };

  const conditions = [];
  // Default to tailors only — pass ?role=admin to include admins.
  conditions.push(eq(users.role, role === "admin" ? "admin" : "tailor"));
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    conditions.push(eq(users.status, status as any));
  }
  if (q && q.trim().length > 0) {
    const needle = `%${q.trim()}%`;
    conditions.push(
      or(like(users.name, needle), like(users.email, needle), like(users.mobile, needle))!
    );
  }

  const rows = await db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt));
  const result = rows.map(publicUser);

  // Optional: attach per-tailor stats ({customers, orders, invoices, revenue})
  // for the admin overview's "Top Tailors" widget.
  if (withStats === "true" && result.length > 0) {
    const tailorIds = result.map((u) => u.id);
    try {
      const [customerCounts, orderCounts, invoiceSums] = await Promise.all([
        db
          .select({
            tailorId: customers.tailorId,
            customers: sql<number>`COUNT(*)`,
          })
          .from(customers)
          .where(inArray(customers.tailorId, tailorIds))
          .groupBy(customers.tailorId),
        db
          .select({
            tailorId: orders.tailorId,
            orders: sql<number>`COUNT(*)`,
          })
          .from(orders)
          .where(inArray(orders.tailorId, tailorIds))
          .groupBy(orders.tailorId),
        db
          .select({
            tailorId: invoices.tailorId,
            invoices: sql<number>`COUNT(*)`,
            revenue: sql<string>`COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END), 0)`,
          })
          .from(invoices)
          .where(inArray(invoices.tailorId, tailorIds))
          .groupBy(invoices.tailorId),
      ]);

      const statsByTailor = new Map<
        string,
        { customers: number; orders: number; invoices: number; revenue: number }
      >();
      const ensure = (id: string) => {
        let s = statsByTailor.get(id);
        if (!s) {
          s = { customers: 0, orders: 0, invoices: 0, revenue: 0 };
          statsByTailor.set(id, s);
        }
        return s;
      };
      for (const r of customerCounts) ensure(r.tailorId).customers = Number(r.customers ?? 0);
      for (const r of orderCounts) ensure(r.tailorId).orders = Number(r.orders ?? 0);
      for (const r of invoiceSums) {
        const s = ensure(r.tailorId);
        s.invoices = Number(r.invoices ?? 0);
        s.revenue = Number(r.revenue ?? 0);
      }
      for (const u of result) {
        const s = statsByTailor.get(u.id) ?? { customers: 0, orders: 0, invoices: 0, revenue: 0 };
        (u as any).stats = s;
      }
    } catch (err) {
      // Stats are decorative — don't 500 if they fail.
      // eslint-disable-next-line no-console
      console.error("[admin] withStats query failed:", (err as Error).message);
    }
  }

  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /api/admin/pending-users
// Backwards-compatible shorthand for the approval queue.
// ---------------------------------------------------------------------------
router.get("/pending-users", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "tailor"), eq(users.status, "pending")))
    .orderBy(desc(users.createdAt));
  res.json(rows.map(publicUser));
});

// ---------------------------------------------------------------------------
// GET /api/admin/users/:id
// Single tailor detail (with counts of their data).
// ---------------------------------------------------------------------------
router.get("/users/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [{ customers: custCount = 0 } = {}] = await db
    .select({ customers: sql<number>`COUNT(*)` })
    .from(customers)
    .where(eq(customers.tailorId, id));
  const [{ orders: ordCount = 0 } = {}] = await db
    .select({ orders: sql<number>`COUNT(*)` })
    .from(orders)
    .where(eq(orders.tailorId, id));
  const [{ invoices: invCount = 0, revenue: revTotal = 0 } = {}] = await db
    .select({
      invoices: sql<number>`COUNT(*)`,
      revenue: sql<string>`COALESCE(SUM(total), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.tailorId, id));
  res.json({
    ...publicUser(u),
    stats: {
      customers: Number(custCount),
      orders: Number(ordCount),
      invoices: Number(invCount),
      revenue: Number(revTotal),
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/approve
// ---------------------------------------------------------------------------
router.post("/users/:id/approve", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await db.update(users).set({ status: "approved" }).where(eq(users.id, id));
  const [after] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await recordAudit(req.user!.id, "approve", id, before ?? null, after ?? null);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/reject
// ---------------------------------------------------------------------------
router.post("/users/:id/reject", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await db.update(users).set({ status: "rejected" }).where(eq(users.id, id));
  const [after] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await recordAudit(req.user!.id, "reject", id, before ?? null, after ?? null);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/suspend
// Soft-block: sets status = 'rejected'. Reversible via /unsuspend.
// ---------------------------------------------------------------------------
router.post("/users/:id/suspend", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  if (id === req.user!.id) {
    res.status(400).json({ error: "Cannot suspend your own account" });
    return;
  }
  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await db.update(users).set({ status: "rejected" }).where(eq(users.id, id));
  const [after] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await recordAudit(req.user!.id, "suspend", id, before ?? null, after ?? null);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/unsuspend
// Re-activate a previously suspended account.
// ---------------------------------------------------------------------------
router.post("/users/:id/unsuspend", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await db.update(users).set({ status: "approved" }).where(eq(users.id, id));
  const [after] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await recordAudit(req.user!.id, "unsuspend", id, before ?? null, after ?? null);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id
// ---------------------------------------------------------------------------
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  mobile: z.string().min(5).optional(),
  role: z.enum(["admin", "tailor"]).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  shopName: z.string().nullable().optional(),
  shopAddress: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  avatarUri: z.string().nullable().optional(),
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const body = updateSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", detail: body.error.flatten() });
    return;
  }
  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!before) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await db.update(users).set(body.data).where(eq(users.id, id));
  const [updated] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await recordAudit(req.user!.id, "patch", id, before, updated ?? null);
  res.json(publicUser(updated));
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id
// Hard delete. Refuses self-deletion. Cascading deletes of customers / orders
// / invoices are handled by FK constraints (or future soft-delete).
// ---------------------------------------------------------------------------
router.delete("/users/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  if (id === req.user!.id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  await db.delete(users).where(eq(users.id, id));
  await recordAudit(req.user!.id, "delete", id, before ?? null, null);
  res.json({ ok: true });
});

export default router;