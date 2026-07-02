/**
 * Email helper — owns the SMTP transport and the email body templates.
 *
 * Two transport modes:
 *   1. **SMTP enabled** — if SMTP_HOST, SMTP_USER and SMTP_PASS are set,
 *      the helper sends real email through the configured provider. This
 *      is the production path.
 *   2. **Demo / dev mode** — if any of the SMTP_HOST/SMTP_USER/SMTP_PASS
 *      env vars are missing, `sendOtpEmail` is a no-op. The caller is
 *      expected to fall back to returning `devOtp` in the JSON so the
 *      mobile app can show it in an alert during local development.
 *
 * Templates live here as functions so they can be unit-tested without a
 * real SMTP connection.
 */
import nodemailer, { type Transporter } from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "Stitchix <no-reply@tailorbook.com>";

let cachedTransport: Transporter | null = null;
let transportInitFailed = false;

export function smtpConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

/**
 * Lazily build the SMTP transport. Returns `null` if SMTP is not
 * configured or the transport can't be initialised.
 */
async function getTransport(): Promise<Transporter | null> {
  if (!smtpConfigured()) return null;
  if (cachedTransport) return cachedTransport;
  if (transportInitFailed) return null;
  try {
    cachedTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return cachedTransport;
  } catch (err) {
    transportInitFailed = true;
    console.error("[email] Failed to initialise SMTP transport:", err);
    return null;
  }
}

// ── Templates ─────────────────────────────────────────────────────────────

/**
 * OTP verification email body. Matches the format the user spec'd.
 */
export function buildOtpEmail(code: string, ttlMinutes: number): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Stitchix - Email Verification Code";
  const text =
    `Hello,\n\n` +
    `Your Stitchix verification code is:\n\n` +
    `  ${code}\n\n` +
    `This OTP is valid for ${ttlMinutes} minutes.\n\n` +
    `Do not share this code with anyone.\n\n` +
    `Regards,\n` +
    `Stitchix Team`;
  const html =
    `<p>Hello,</p>` +
    `<p>Your Stitchix verification code is:</p>` +
    `<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; ` +
    `font-family: monospace;">${code}</p>` +
    `<p>This OTP is valid for ${ttlMinutes} minutes.</p>` +
    `<p><strong>Do not share this code with anyone.</strong></p>` +
    `<p>Regards,<br/>Stitchix Team</p>`;
  return { subject, text, html };
}

/**
 * Password reset OTP email body. Used for the forgot-password flow.
 */
export function buildPasswordResetEmail(code: string, ttlMinutes: number): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Stitchix - Password Reset Code";
  const text =
    `Hello,\n\n` +
    `You requested to reset your Stitchix account password.\n\n` +
    `Your password reset code is:\n\n` +
    `  ${code}\n\n` +
    `This code is valid for ${ttlMinutes} minutes.\n\n` +
    `Do not share this code with anyone.\n\n` +
    `If you did not request this reset, you can safely ignore this email.\n\n` +
    `Regards,\n` +
    `Stitchix Team`;
  const html =
    `<p>Hello,</p>` +
    `<p>You requested to reset your <strong>Stitchix</strong> account password.</p>` +
    `<p>Your password reset code is:</p>` +
    `<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; ` +
    `font-family: monospace;">${code}</p>` +
    `<p>This code is valid for ${ttlMinutes} minutes.</p>` +
    `<p><strong>Do not share this code with anyone.</strong></p>` +
    `<p>If you did not request this reset, you can safely ignore this email.</p>` +
    `<p>Regards,<br/>Stitchix Team</p>`;
  return { subject, text, html };
}

// ── Senders ───────────────────────────────────────────────────────────────

export interface SendResult {
  delivered: boolean;
  via: "smtp" | "demo";
  reason?: string;
}

/**
 * Send an OTP email. Falls back to demo mode if SMTP is not configured.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
  ttlMinutes = 10,
): Promise<SendResult> {
  const { subject, text, html } = buildOtpEmail(code, ttlMinutes);
  const transport = await getTransport();
  if (!transport) {
    return { delivered: false, via: "demo", reason: "SMTP not configured" };
  }
  try {
    await transport.sendMail({ from: SMTP_FROM, to, subject, text, html });
    return { delivered: true, via: "smtp" };
  } catch (err) {
    console.error("[email] Failed to send OTP email:", err);
    return {
      delivered: false,
      via: "demo",
      reason: (err as Error).message,
    };
  }
}

/**
 * Send a password reset OTP email. Falls back to demo mode if SMTP is not configured.
 */
export async function sendPasswordResetEmail(
  to: string,
  code: string,
  ttlMinutes = 10,
): Promise<SendResult> {
  const { subject, text, html } = buildPasswordResetEmail(code, ttlMinutes);
  const transport = await getTransport();
  if (!transport) {
    return { delivered: false, via: "demo", reason: "SMTP not configured" };
  }
  try {
    await transport.sendMail({ from: SMTP_FROM, to, subject, text, html });
    return { delivered: true, via: "smtp" };
  } catch (err) {
    console.error("[email] Failed to send password reset email:", err);
    return {
      delivered: false,
      via: "demo",
      reason: (err as Error).message,
    };
  }
}

/**
 * Generic text email — used by the dispatch-delivery route when SMTP is
 * configured. Falls back to demo mode.
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<SendResult> {
  const transport = await getTransport();
  if (!transport) {
    return { delivered: false, via: "demo", reason: "SMTP not configured" };
  }
  try {
    await transport.sendMail({ from: SMTP_FROM, to, subject, text });
    return { delivered: true, via: "smtp" };
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return {
      delivered: false,
      via: "demo",
      reason: (err as Error).message,
    };
  }
}
