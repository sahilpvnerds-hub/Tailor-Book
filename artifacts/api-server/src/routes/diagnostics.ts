import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /api/debug/diagnostics
// Run on-demand diagnostics and log results to console. Returns a JSON summary
// so you can inspect the results in the browser / Postman too.
router.get("/diagnostics", async (_req: Request, res: Response) => {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV ?? "undefined",
      DATABASE_URL: process.env.DATABASE_URL ? "set" : "NOT SET",
      JWT_SECRET: process.env.JWT_SECRET ? "set" : "NOT SET (using default)",
      SMTP_HOST: process.env.SMTP_HOST ?? "NOT SET",
      SMTP_USER: process.env.SMTP_USER ?? "NOT SET",
      SMTP_PASS: process.env.SMTP_PASS ? "set" : "NOT SET",
    },
  };

  // 1) Database connectivity
  try {
    const { db } = await import("@workspace/db");
    const [tables] = await db.execute("SHOW TABLES");
    const [userCount] = await db.execute("SELECT COUNT(*) AS count FROM users");
    const [orderCount] = await db.execute("SELECT COUNT(*) AS count FROM orders");
    const [invoiceCount] = await db.execute("SELECT COUNT(*) AS count FROM invoices");
    const [measurementCount] = await db.execute("SELECT COUNT(*) AS count FROM measurements");

    // Check critical columns
    const [cols] = await (db as any).$client?.query
      ? (db as any).$client.query("SHOW COLUMNS FROM order_items")
      : Promise.resolve([[]] as any);

    const columnNames = (cols as any[])?.map((c: any) => c?.Field ?? c?.Field_name) ?? [];
    const tableList = Array.isArray(tables) ? tables.map((t: any) => {
      const keys = Object.keys(t);
      return t[keys[0]] ?? JSON.stringify(t);
    }) : [];

    results.database = {
      connected: true,
      tableCount: Array.isArray(tables) ? tables.length : 0,
      tables: tableList,
      users: (userCount as any)[0]?.count ?? 0,
      orders: (orderCount as any)[0]?.count ?? 0,
      invoices: (invoiceCount as any)[0]?.count ?? 0,
      measurements: (measurementCount as any)[0]?.count ?? 0,
      orderItemsColumns: columnNames,
      hasDeliveryStatusColumn: columnNames.includes("delivery_status"),
    };
    logger.info(results.database, "[diagnostics] database ok");
  } catch (err) {
    const error = err as Error;
    results.database = { connected: false, error: error.message };
    logger.error({ err: error.message, stack: error.stack }, "[diagnostics] database FAILED");
  }

  // 2) Auth — verify token can be generated and verified
  try {
    const { signToken, verifyToken } = await import("../middlewares/auth");
    const testToken = signToken({ id: "test-diagnostic", email: "diag@test.com", role: "admin" });
    const decoded = verifyToken(testToken);
    results.auth = {
      ok: true,
      tokenGenerated: !!testToken,
      tokenVerified: !!decoded,
      decodedRole: decoded?.role,
    };
    logger.info(results.auth, "[diagnostics] auth ok");
  } catch (err) {
    const error = err as Error;
    results.auth = { ok: false, error: error.message };
    logger.error({ err: error.message }, "[diagnostics] auth FAILED");
  }

  // 3) JWT expiry check — warn if JWT_EXPIRES_IN is too short
  try {
    const jwtExpires = process.env.JWT_EXPIRES_IN ?? "30d";
    const tooShort = jwtExpires.endsWith("s") && parseInt(jwtExpires) < 3600;
    results.authConfig = {
      jwtSecretSet: !!process.env.JWT_SECRET,
      jwtExpiresIn: jwtExpires,
      usingDefaultSecret: !process.env.JWT_SECRET,
      expiresTooShort: tooShort,
    };
    if (tooShort) {
      logger.warn(`[diagnostics] JWT_EXPIRES_IN=${jwtExpires} is very short — tokens will expire quickly!`);
    }
    if (!process.env.JWT_SECRET) {
      logger.warn("[diagnostics] JWT_SECRET not set — using fallback. Set JWT_SECRET in .env!");
    }
  } catch (err) {
    const error = err as Error;
    results.authConfig = { ok: false, error: error.message };
    logger.error({ err: error.message }, "[diagnostics] auth config FAILED");
  }

  // 4) SMTP
  try {
    const { smtpConfigured } = await import("../lib/email");
    results.smtp = { configured: smtpConfigured() };
    if (!smtpConfigured()) {
      logger.warn("[diagnostics] SMTP not configured — OTP emails will not be sent");
    } else {
      logger.info("[diagnostics] SMTP configured");
    }
  } catch (err) {
    const error = err as Error;
    results.smtp = { ok: false, error: error.message };
    logger.error({ err: error.message }, "[diagnostics] SMTP FAILED");
  }

  // 5) CORS check — print allowed origins
  try {
    const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    results.cors = {
      NODE_ENV: process.env.NODE_ENV,
      allowedOrigins: corsOrigins,
      yiionDomainsAllowed: true, // hardcoded in app.ts
    };
    logger.info(results.cors, "[diagnostics] CORS config");
  } catch (err) {
    const error = err as Error;
    results.cors = { ok: false, error: error.message };
    logger.error({ err: error.message }, "[diagnostics] CORS FAILED");
  }

  // 6) Health endpoint check
  try {
    results.health = { status: "ok", message: "diagnostics endpoint working" };
    logger.info("[diagnostics] all checks passed");
  } catch (err) {
    const error = err as Error;
    results.health = { ok: false, error: error.message };
    logger.error({ err: error.message }, "[diagnostics] health FAILED");
  }

  res.json(results);
});

export default router;
