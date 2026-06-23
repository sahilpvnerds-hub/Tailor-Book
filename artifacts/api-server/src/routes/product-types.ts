import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  productTypes,
  measurements,
  measurementItems,
  orderItems,
  invoiceItems,
} from "@workspace/db/schema";
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

  // Propagate the new feature list to existing records so the change
  // takes effect everywhere — see also the same logic in
  // artifacts/mobile/context/DataContext.tsx for the offline flow.
  if (body.data.features !== undefined) {
    const newLabels = body.data.features.map((f) => f.label);
    const newLabelSet = new Set(newLabels);
    const previousLabels = (existing.features ?? []).map((f: any) => f.label);
    const previousLabelSet = new Set(previousLabels);

    const renamedLabelMap = new Map<string, string>();
    const removed = (existing.features ?? []).filter((f: any) => !newLabelSet.has(f.label));
    const added = body.data.features.filter((f) => !previousLabelSet.has(f.label));
    removed.forEach((r: any, i: number) => {
      const candidate = added[i] ?? added.find((a) => a.gender === r.gender);
      if (candidate) renamedLabelMap.set(r.label, candidate.label);
    });

    const remapLabel = (label: string | null | undefined) => {
      if (!label) return label;
      const parts = label.split(",").map((s) => s.trim()).filter(Boolean);
      const next: string[] = [];
      for (const p of parts) {
        if (newLabelSet.has(p)) next.push(p);
        else if (renamedLabelMap.has(p)) next.push(renamedLabelMap.get(p)!);
      }
      return next.join(", ");
    };

    // PATCH measurements (this table has no productTypeId column —
    // match by name since each tailor's product name is unique to them)
    const meas = await db
      .select()
      .from(measurements)
      .where(eq(measurements.productType, existing.name));
    for (const m of meas) {
      const newLabel = remapLabel((m as any).featureLabel);
      if (newLabel !== (m as any).featureLabel) {
        await db
          .update(measurements)
          .set({ featureLabel: newLabel as any } as any)
          .where(eq(measurements.id, (m as any).id));
      }
    }

    // PATCH measurement_items
    const mItems = await db
      .select()
      .from(measurementItems)
      .where(eq(measurementItems.productTypeId, id));
    for (const mi of mItems) {
      const newLabel = remapLabel((mi as any).featureLabel);
      if (newLabel !== (mi as any).featureLabel) {
        await db
          .update(measurementItems)
          .set({ featureLabel: newLabel as any } as any)
          .where(eq(measurementItems.id, (mi as any).id));
      }
    }

    // PATCH order_items
    const oItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.productTypeId, id));
    for (const it of oItems) {
      const newLabel = remapLabel((it as any).featureLabel);
      if (newLabel !== (it as any).featureLabel) {
        await db
          .update(orderItems)
          .set({ featureLabel: newLabel as any } as any)
          .where(eq(orderItems.id, (it as any).id));
      }
    }

    // PATCH invoice_items
    const iItems = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.productTypeId, id));
    for (const it of iItems) {
      const newLabel = remapLabel((it as any).featureLabel);
      if (newLabel !== (it as any).featureLabel) {
        await db
          .update(invoiceItems)
          .set({ featureLabel: newLabel as any } as any)
          .where(eq(invoiceItems.id, (it as any).id));
      }
    }
  }

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
