import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { signToken, authMiddleware } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// --- POST /api/auth/login -------------------------------------------------
router.post("/login", async (req: Request, res: Response) => {
  const body = z
    .object({
      emailOrMobile: z.string().min(1),
      password: z.string().min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { emailOrMobile, password } = body.data;

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, emailOrMobile), eq(users.mobile, emailOrMobile)))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Compare against bcrypt hash. If the stored password is plain text (legacy
  // seed), bcrypt will fail, in which case we fall back to direct comparison
  // so the seed data still works.
  let ok = false;
  try {
    ok = await bcrypt.compare(password, user.password);
  } catch {
    ok = user.password === password;
  }
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.status === "pending") {
    res.status(403).json({ error: "Your account is pending admin approval" });
    return;
  }
  if (user.status === "rejected") {
    res.status(403).json({ error: "Your account has been rejected" });
    return;
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      shopName: user.shopName,
      shopAddress: user.shopAddress,
      city: user.city,
      state: user.state,
      avatarUri: user.avatarUri,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
});

// --- POST /api/auth/register ----------------------------------------------
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().min(5),
  password: z.string().min(6),
  shopName: z.string().optional().default(""),
  shopAddress: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
});

router.post("/register", async (req: Request, res: Response) => {
  const body = registerSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", issues: body.error.issues });
    return;
  }
  const d = body.data;

  const existing = await db
    .select({ id: users.id, email: users.email, mobile: users.mobile, status: users.status })
    .from(users)
    .where(or(eq(users.email, d.email), eq(users.mobile, d.mobile)))
    .limit(1);
  if (existing.length > 0) {
    const dupe = existing[0];
    const conflictField =
      dupe.email === d.email ? "email" : dupe.mobile === d.mobile ? "mobile" : "email or mobile";
    res.status(409).json({
      error: `Account with this ${conflictField} already exists`,
      conflict: { field: conflictField, status: dupe.status },
    });
    return;
  }

  const id = crypto.randomUUID();
  const hashedPassword = await bcrypt.hash(d.password, 10);

  await db.insert(users).values({
    id,
    name: d.name,
    email: d.email,
    mobile: d.mobile,
    password: hashedPassword,
    role: "tailor",
    shopName: d.shopName,
    shopAddress: d.shopAddress,
    city: d.city,
    state: d.state,
    status: "pending",
  });

  res.status(201).json({ id, message: "Registration submitted for approval" });
});

// --- GET /api/auth/me -----------------------------------------------------
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    shopName: user.shopName,
    shopAddress: user.shopAddress,
    city: user.city,
    state: user.state,
    avatarUri: user.avatarUri,
    status: user.status,
    createdAt: user.createdAt,
  });
});

// --- POST /api/auth/logout ------------------------------------------------
// Stateless JWT — client just deletes the token. We keep this endpoint for
// future session table integration.
router.post("/logout", authMiddleware, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// --- PATCH /api/auth/me ---------------------------------------------------
// Update the authenticated user's own profile. Users can update only their
// own name, email, mobile, shop info, and avatar. Role and status are admin-
// only fields and are NOT exposed here.
const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  mobile: z.string().min(5).optional(),
  shopName: z.string().nullable().optional(),
  shopAddress: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  avatarUri: z.string().nullable().optional(),
});

router.patch("/me", authMiddleware, async (req: Request, res: Response) => {
  const body = updateMeSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  await db.update(users).set(body.data).where(eq(users.id, req.user!.id));
  const [updated] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user!.id))
    .limit(1);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    mobile: updated.mobile,
    role: updated.role,
    shopName: updated.shopName,
    shopAddress: updated.shopAddress,
    city: updated.city,
    state: updated.state,
    avatarUri: updated.avatarUri,
    status: updated.status,
    createdAt: updated.createdAt,
  });
});

export default router;
