import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { pendingOtps, users } from "@workspace/db/schema";
import { signToken, authMiddleware } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rate-limit";
import { sendOtpEmail, smtpConfigured } from "../lib/email";
import { z } from "zod";

const router: IRouter = Router();

// Brute-force protection on the login route. 5 attempts per IP per 15 minutes
// — anything more is rejected with 429. Users that legitimately hit the limit
// can wait it out (the headers indicate the remaining seconds).
const loginRateLimit = rateLimit({ limit: 5, windowMs: 15 * 60_000, key: "login" });

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
    preferredLanguage: u.preferredLanguage,
    latitude: u.latitude,
    longitude: u.longitude,
    createdAt: u.createdAt,
  };
}

// --- POST /api/auth/check-availability -------------------------------------
// Lightweight pre-check the mobile app calls before sending the OTP. Returns
// whether the given email or mobile is already registered so the user can be
// shown a friendly error before they wait for an email.
router.post("/check-availability", async (req: Request, res: Response) => {
  const body = z
    .object({
      email: z.string().email().optional(),
      mobile: z.string().min(5).optional(),
    })
    .refine((d) => d.email || d.mobile, {
      message: "At least one of email or mobile is required",
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Provide email or mobile to check" });
    return;
  }
  const d = body.data;
  const conditions = [];
  if (d.email) conditions.push(eq(users.email, d.email.toLowerCase().trim()));
  if (d.mobile) conditions.push(eq(users.mobile, d.mobile.trim()));
  const rows = await db
    .select({ email: users.email, mobile: users.mobile })
    .from(users)
    .where(conditions.length > 1 ? or(...conditions) : conditions[0])
    .limit(1);
  if (rows.length === 0) {
    res.json({ available: true });
    return;
  }
  const taken = rows[0];
  const conflicts: string[] = [];
  if (d.email && taken.email === d.email.toLowerCase().trim()) conflicts.push("email");
  if (d.mobile && taken.mobile === d.mobile.trim()) conflicts.push("mobile");
  res.status(409).json({
    available: false,
    conflicts,
    message:
      conflicts.length === 2
        ? "An account with this email and mobile already exists"
        : `An account with this ${conflicts[0]} already exists`,
  });
});

// --- POST /api/auth/send-otp ----------------------------------------------
// Generate a 6-digit OTP for the given email and store it in pending_otps.
// The OTP is delivered via the configured SMTP server (Gmail). If SMTP
// is not configured OR the send fails, the request is rejected — the
// OTP is never returned in the response anymore.
router.post("/send-otp", async (req: Request, res: Response) => {
  const body = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  const email = body.data.email.toLowerCase().trim();

  if (!smtpConfigured()) {
    res.status(503).json({
      error: "Email service is not configured. Please contact support.",
    });
    return;
  }

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

  // Send via SMTP. If delivery fails, the OTP stays in the DB but we do
  // not return it to the client — the user must request a new one.
  const delivery = await sendOtpEmail(email, otp, 10);
  if (!delivery.delivered) {
    console.error(
      `[send-otp] SMTP delivery failed for ${email}:`,
      delivery.reason,
    );
    res.status(502).json({
      error: `Failed to send OTP email. ${delivery.reason ?? "Please try again."}`,
    });
    return;
  }

  res.json({
    ok: true,
    message: `OTP sent to ${email}`,
    expiresAt: expiresAt.toISOString(),
    ttlMs: OTP_TTL_MS,
    delivered: true,
    channel: "smtp",
  });
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
router.post("/login", loginRateLimit, async (req: Request, res: Response) => {
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

  // Rejected accounts still can't login. (Admins no longer reject newly
  // registered tailors, but legacy rejected accounts remain blocked.)
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
//
// As of the 0006_enhancements migration, new tailors are auto-approved on
// successful registration — there is no admin approval gate. The
// `status` column is kept on the table for legacy data.
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
      // New in 0006_enhancements
      preferredLanguage: z.enum(["en", "hi", "gu"]).optional().default("en"),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
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

  // Coerce optional lat/lng into strings so Drizzle can insert into decimal.
  // Drizzle accepts `null` for nullable decimal columns; we use that when
  // the client didn't supply coordinates.
  const latitude = d.latitude != null ? String(d.latitude) : null;
  const longitude = d.longitude != null ? String(d.longitude) : null;

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
    status: "approved", // Auto-approve on successful registration
    emailVerifiedAt: d.emailVerifiedAt ? new Date(d.emailVerifiedAt) : new Date(),
    preferredLanguage: d.preferredLanguage,
    latitude,
    longitude,
  });

  res.status(201).json({
    id,
    message: "Account created — you can now log in",
    status: "approved",
  });
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
// own name, email, mobile, shop info, language, GPS, and avatar. Role and
// status are admin-only fields and are NOT exposed here.
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
  // New in 0006_enhancements
  preferredLanguage: z.enum(["en", "hi", "gu"]).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});
router.patch("/me", authMiddleware, async (req: Request, res: Response) => {
  const body = updateMeSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const data = body.data;
  // Coerce lat/lng from number → string for the decimal column.
  const update: Record<string, unknown> = { ...data };
  if ("latitude" in data) {
    update.latitude = data.latitude == null ? null : String(data.latitude);
  }
  if ("longitude" in data) {
    update.longitude = data.longitude == null ? null : String(data.longitude);
  }
  await db.update(users).set(update).where(eq(users.id, req.user!.id));
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
