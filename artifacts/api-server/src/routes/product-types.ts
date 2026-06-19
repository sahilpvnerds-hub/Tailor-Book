import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { productTypes } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth";
import { getParam } from "../lib/params";

const router: IRouter = Router();
router.use(authMiddleware);

function ensureOwnership(req: Request, tailorId: string) {
  if (req.user!.role === "admin") return true;
  return tailorId === req.user!.id;
}

function visibleFilter(req: Request) {
  return req.user!.role === "admin"
    ? undefined
    : eq(productTypes.tailorId, req.user!.id);
}

// Feature sub-type schema
const featureSchema = z.object({
  label: z.string().min(1).max(100),
  gender: z.enum(["male", "female", "both"]).optional(),
});

// ---- GET /api/product-types ---------------------------------------------
router.get("/", async (req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(productTypes)
    .where(visibleFilter(req))
    .orderBy(desc(productTypes.createdAt));
  res.json(rows);
});

// ---- POST /api/product-types --------------------------------------------
const createSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().nonnegative().default(0),
  unit: z.enum(["inches", "cm"]).optional(),
  features: z.array(featureSchema).optional().default([]),
});

router.post("/", async (req: Request, res: Response) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", issues: body.error.issues });
    return;
  }
  const id = crypto.randomUUID();
  await db.insert(productTypes).values({
    id,
    tailorId: req.user!.id,
    name: body.data.name,
    amount: String(body.data.amount),
    unit: body.data.unit ?? "inches",
    features: body.data.features ?? [],
  });
  const [row] = await db
    .select()
    .from(productTypes)
    .where(eq(productTypes.id, id))
    .limit(1);
  res.status(201).json(row);
});

// ---- PATCH /api/product-types/:id ---------------------------------------
const updateSchema = createSchema.partial();
router.patch("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(productTypes)
    .where(eq(productTypes.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Product type not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = updateSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", issues: body.error.issues });
    return;
  }
  const patch: Record<string, unknown> = { ...body.data };
  if (patch.amount !== undefined) patch.amount = String(patch.amount);
  await db.update(productTypes).set(patch as any).where(eq(productTypes.id, id));
  const [updated] = await db
    .select()
    .from(productTypes)
    .where(eq(productTypes.id, id))
    .limit(1);
  res.json(updated);
});

// ---- DELETE /api/product-types/:id -------------------------------------
router.delete("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(productTypes)
    .where(eq(productTypes.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Product type not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(productTypes).where(eq(productTypes.id, id));
  res.json({ ok: true });
});

export default router;
