import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { familyMembers, customers } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth";
import { getParam } from "../lib/params";

const router: IRouter = Router();
router.use(authMiddleware);

function ensureOwnership(req: Request, tailorId: string) {
  if (req.user!.role === "admin") return true;
  return tailorId === req.user!.id;
}

// ---- GET /api/family-members?primaryCustomerId=... ---------------------
router.get("/", async (req: Request, res: Response) => {
  const { primaryCustomerId } = req.query as { primaryCustomerId?: string };
  const conditions = [];
  if (req.user!.role !== "admin") {
    conditions.push(eq(familyMembers.tailorId, req.user!.id));
  }
  if (primaryCustomerId) {
    conditions.push(eq(familyMembers.primaryCustomerId, primaryCustomerId));
  }
  const rows = await db
    .select()
    .from(familyMembers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(familyMembers.createdAt));
  res.json(rows);
});

// ---- POST /api/family-members -------------------------------------------
const createSchema = z.object({
  primaryCustomerId: z.string().min(1),
  name: z.string().min(1).max(100),
  relation: z.enum([
    "father", "mother", "son", "daughter", "wife", "husband", "brother", "sister", "other",
  ]).default("other"),
  gender: z.enum(["male", "female", "unisex"]).default("unisex"),
});

router.post("/", async (req: Request, res: Response) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const d = body.data;

  // Verify primary customer exists and belongs to this tailor.
  const [cust] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, d.primaryCustomerId))
    .limit(1);
  if (!cust) {
    res.status(404).json({ error: "Primary customer not found" });
    return;
  }
  if (!ensureOwnership(req, cust.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = crypto.randomUUID();
  await db.insert(familyMembers).values({
    id,
    tailorId: req.user!.id,
    primaryCustomerId: d.primaryCustomerId,
    name: d.name,
    relation: d.relation,
    gender: d.gender,
  });
  const [row] = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.id, id))
    .limit(1);
  res.status(201).json(row);
});

// ---- DELETE /api/family-members/:id -------------------------------------
router.delete("/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  const [existing] = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Family member not found" });
    return;
  }
  if (!ensureOwnership(req, existing.tailorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(familyMembers).where(eq(familyMembers.id, id));
  res.json({ ok: true });
});

export default router;
