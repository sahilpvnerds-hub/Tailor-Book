import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { customers } from "@workspace/db/schema";
import { authMiddleware, adminOnly } from "../middlewares/auth";
import { getParam } from "../lib/params";

const router: IRouter = Router();
router.use(authMiddleware);

// ---- Helpers ---------------------------------------------------------------
function customerVisibleFilter(req: Request) {
  // Admin sees all customers; tailor sees only their own.
  return req.user!.role === "admin"
    ? undefined
    : eq(customers.tailorId, req.user!.id);
}

function ensureOwnership(req: Request, tailorId: string) {
  if (req.user!.role === "admin") return true;
  return tailorId === req.user!.id;
}

// ---- GET /api/customers ---------------------------------------------------
router.get("/", async (req: Request, res: Response) => {
  const filters = [];
  const base = customerVisibleFilter(req);
  if (base) filters.push(base);

  // Admin can drill down by tailorId.
  const { tailorId } = req.query as { tailorId?: string };
  if (tailorId && req.user!.role === "admin") {
    filters.push(eq(customers.tailorId, tailorId));
  }

  const rows = await db
    .select()
    .from(customers)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(customers.createdAt));
  res.json(rows);
});

// ---- GET /api/customers/:id -----------------------------------------------
router.get("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [c] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!c) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  if (!ensureOwnership(req, c.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(c);
});

// ---- POST /api/customers --------------------------------------------------
const createSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(5),
  gender: z.enum(["male", "female", "unisex"]).default("unisex"),
  familyId: z.string().nullable().optional(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  profilePicture: z.string().url().max(2048).optional().nullable(),
});

router.post("/", async (req: Request, res: Response) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const id = crypto.randomUUID();
  await db.insert(customers).values({
    id,
    tailorId: req.user!.id,
    familyId: body.data.familyId ?? null,
    name: body.data.name,
    mobile: body.data.mobile,
    gender: body.data.gender,
    email: body.data.email ?? null,
    address: body.data.address ?? null,
    notes: body.data.notes ?? null,
    profilePicture: body.data.profilePicture ?? null,
  });
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  res.status(200).json(c);
});

// ---- PATCH /api/customers/:id --------------------------------------------
const updateSchema = createSchema.partial();

router.patch("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Customer not found" });
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

  await db.update(customers).set(body.data).where(eq(customers.id, id));
  const [updated] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  res.json(updated);
});

// ---- DELETE /api/customers/:id ------------------------------------------
// Cascading delete: removing a customer also removes their family
// members, measurements, orders and invoices via the FK ON DELETE
// CASCADE constraints declared in db/schema.sql (see
// db/migrate_cascade_deletes.sql for the migration that adds them).
router.delete("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(customers).where(eq(customers.id, id));
  res.json({ ok: true });
});

export default router;
