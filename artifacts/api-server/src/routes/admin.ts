import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { authMiddleware, adminOnly } from "../middlewares/auth";
import { getParam } from "../lib/params";

const router: IRouter = Router();
router.use(authMiddleware, adminOnly);

// ---- GET /api/admin/users -------------------------------------------------
router.get("/users", async (_req: Request, res: Response) => {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  res.json(rows.map((u) => ({ ...u, password: undefined })));
});

// ---- GET /api/admin/pending-users ----------------------------------------
router.get("/pending-users", async (_req: Request, res: Response) => {
  const rows = await db.select().from(users).where(eq(users.status, "pending"));
  res.json(rows.map((u) => ({ ...u, password: undefined })));
});

// ---- POST /api/admin/users/:id/approve -----------------------------------
router.post("/users/:id/approve", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  await db.update(users).set({ status: "approved" }).where(eq(users.id, id));
  res.json({ ok: true });
});

// ---- POST /api/admin/users/:id/reject ------------------------------------
router.post("/users/:id/reject", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  await db.update(users).set({ status: "rejected" }).where(eq(users.id, id));
  res.json({ ok: true });
});

// ---- PATCH /api/admin/users/:id ------------------------------------------
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
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  await db.update(users).set(body.data).where(eq(users.id, id));
  const [updated] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  res.json({ ...updated, password: undefined });
});

// ---- DELETE /api/admin/users/:id -----------------------------------------
router.delete("/users/:id", async (req: Request, res: Response) => {
  const id = getParam(req, "id");
  if (id === req.user!.id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  await db.delete(users).where(eq(users.id, id));
  res.json({ ok: true });
});

export default router;
