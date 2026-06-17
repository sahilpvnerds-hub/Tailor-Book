import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { notifications } from "@workspace/db/schema";
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
    "delivery_due_today", "delivery_due_tomorrow", "pending_invoice", "general",
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
