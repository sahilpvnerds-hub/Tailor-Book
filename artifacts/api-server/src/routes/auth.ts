import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { pendingOtps, users } from "@workspace/db/schema";
import { signToken, authMiddleware } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function userResponse(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    role: u.role,
    speciality: u.speciality,
    shopName: u.shopName,
    shopAddress: u.shopAddress,
    city: u.city,
    state: u.state,
    avatarUri: u.avatarUri,
    status: u.status,
    emailVerifiedAt: u.emailVerifiedAt,
    onboardingComplete: u.onboardingComplete,
    createdAt: u.createdAt,
  };
}

// --- POST /api/auth/send-otp ----------------------------------------------
// Generate a 6-digit OTP for the given email and store it in pending_otps.
// In demo mode (no SMTP env vars) the OTP is returned in the response so the
// mobile app can show it in an alert. In production we'd send it via email.
router.post("/send-otp", async (req: Request, res: Response) => {
  const body = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  const email = body.data.email.toLowerCase().trim();

  // Invalidate any older unused OTPs for this email
  await db.delete(pendingOtps).where(eq(pendingOtps.email, email));

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.insert(pendingOtps).values({
    id: crypto.randomUUID(),
    email,
    otp,
    expiresAt,
    attempts: 0,
    consumed: false,
  });

  // SMTP is not configured, so we return the OTP for the demo alert.
  // When SMTP is wired up, this would dispatch an email and not return it.
  const hasSmtp = !!process.env.SMTP_HOST;
  const out: Record<string, unknown> = {
    ok: true,
    message: hasSmtp
      ? `OTP sent to ${email}`
      : `OTP generated for ${email} (demo mode — no SMTP configured)`,
    expiresAt: expiresAt.toISOString(),
    ttlMs: OTP_TTL_MS,
  };
  if (!hasSmtp) out.devOtp = otp;

  res.json(out);
});

// --- POST /api/auth/verify-otp --------------------------------------------
// Verify a 6-digit OTP for the given email. On success, mark the OTP consumed
// and return the verified-at timestamp. The mobile app then passes that same
// email to /api/auth/register, where we re-verify there is a recently-
// consumed OTP for this email (a small window prevents replay).
router.post("/verify-otp", async (req: Request, res: Response) => {
  const body = z
    .object({ email: z.string().email(), otp: z.string().regex(/^\d{6}$/) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Email and 6-digit OTP are required" });
    return;
  }
  const email = body.data.email.toLowerCase().trim();
  const otp = body.data.otp;

  // Find the latest unconsumed, non-expired OTP for this email
  const [record] = await db
    .select()
    .from(pendingOtps)
    .where(
      and(
        eq(pendingOtps.email, email),
        eq(pendingOtps.consumed, false),
        gt(pendingOtps.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(pendingOtps.createdAt))
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "No active OTP for this email. Please request a new one." });
    return;
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await db.delete(pendingOtps).where(eq(pendingOtps.id, record.id));
    res.status(429).json({ error: "Too many attempts. Please request a new OTP." });
    return;
  }

  if (record.otp !== otp) {
    await db
      .update(pendingOtps)
      .set({ attempts: record.attempts + 1 })
      .where(eq(pendingOtps.id, record.id));
    res.status(400).json({ error: "Invalid OTP. Please try again." });
    return;
  }

  // Mark consumed. /api/auth/register checks for a consumed OTP for this
  // email in the last 30 minutes.
  await db
    .update(pendingOtps)
    .set({ consumed: true })
    .where(eq(pendingOtps.id, record.id));

  res.json({ ok: true, emailVerifiedAt: new Date().toISOString() });
});

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
  res.json({ token, user: userResponse(user) });
});

// --- POST /api/auth/register ----------------------------------------------
// Requires that the email was verified via /api/auth/verify-otp within the
// last 30 minutes (a recently-consumed pending_otps row for this email).
// The client passes the emailVerifiedAt it received from verify-otp so the
// created user record can record when verification happened.
router.post("/register", async (req: Request, res: Response) => {
  const body = z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      mobile: z.string().min(5),
      password: z.string().min(6),
      speciality: z.enum(["male", "female", "unisex"]).optional(),
      shopName: z.string().optional().default(""),
      shopAddress: z.string().optional().default(""),
      city: z.string().optional().default(""),
      state: z.string().optional().default(""),
      emailVerifiedAt: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", issues: body.error.issues });
    return;
  }
  const d = body.data;
  const email = d.email.toLowerCase().trim();

  // Check that the email was verified in the last 30 minutes
  const recentVerified = await db
    .select({ id: pendingOtps.id, createdAt: pendingOtps.createdAt })
    .from(pendingOtps)
    .where(
      and(
        eq(pendingOtps.email, email),
        eq(pendingOtps.consumed, true),
        gt(pendingOtps.createdAt, new Date(Date.now() - 30 * 60 * 1000)),
      ),
    )
    .orderBy(desc(pendingOtps.createdAt))
    .limit(1);

  if (recentVerified.length === 0) {
    res
      .status(403)
      .json({ error: "Email not verified. Please verify your email OTP before registering." });
    return;
  }

  const existing = await db
    .select({ id: users.id, email: users.email, mobile: users.mobile, status: users.status })
    .from(users)
    .where(or(eq(users.email, email), eq(users.mobile, d.mobile)))
    .limit(1);
  if (existing.length > 0) {
    const dupe = existing[0];
    const conflictField =
      dupe.email === email ? "email" : dupe.mobile === d.mobile ? "mobile" : "email or mobile";
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
    email,
    mobile: d.mobile,
    password: hashedPassword,
    role: "tailor",
    speciality: d.speciality ?? null,
    shopName: d.shopName,
    shopAddress: d.shopAddress,
    city: d.city,
    state: d.state,
    status: "pending",
    emailVerifiedAt: d.emailVerifiedAt ? new Date(d.emailVerifiedAt) : new Date(),
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
  res.json(userResponse(user));
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
  speciality: z.enum(["male", "female", "unisex"]).nullable().optional(),
  onboardingComplete: z.boolean().optional(),
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
  res.json(userResponse(updated));
});

export default router;
