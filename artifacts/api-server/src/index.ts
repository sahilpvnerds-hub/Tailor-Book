// Load .env FIRST, before any other imports that read process.env.
import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

// Helpful log so we know which .env was loaded.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Comprehensive startup config dump ────────────────────────────────────────
// Print every relevant env var so you can immediately spot misconfig.
const SECRET_MASK = "***SET***";
const SECRET_EMPTY = "NOT SET";

function mask(v: string | undefined, showLen = 4): string {
  if (!v) return SECRET_EMPTY;
  if (v.length <= showLen) return SECRET_MASK;
  return `${v.slice(0, showLen)}…${SECRET_MASK}`;
}

function envLine(key: string, sensitive = false): string {
  const val = process.env[key];
  return `  ${key.padEnd(30)} = ${sensitive ? (val ? SECRET_MASK : SECRET_EMPTY) : (val ?? SECRET_EMPTY)}`;
}

console.log("\n╔══════════════════════════════════════════╗");
console.log("║     Tailor Book API — startup config      ║");
console.log("╚══════════════════════════════════════════╝");
console.log(`\n  Started at: ${new Date().toISOString()}`);
console.log(`  Process ID : ${process.pid}`);
console.log(`  Node       : ${process.version}`);
console.log(`  Platform   : ${process.platform} ${process.arch}`);

console.log("\n── Runtime ─────────────────────────────────");
console.log(envLine("NODE_ENV"));
console.log(envLine("PORT"));

console.log("\n── Database ────────────────────────────────");
console.log(envLine("DATABASE_URL", true));

console.log("\n── Auth / JWT ──────────────────────────────");
console.log(envLine("JWT_SECRET", true));
console.log(envLine("JWT_EXPIRES_IN"));
console.log(envLine("ADMIN_PASSWORD", true));

console.log("\n── Email / SMTP ────────────────────────────");
console.log(envLine("SMTP_HOST"));
console.log(envLine("SMTP_PORT"));
console.log(envLine("SMTP_USER"));
console.log(envLine("SMTP_PASS", true));
console.log(envLine("SMTP_FROM"));
console.log(envLine("SMTP_SECURE"));

console.log("\n── CORS ────────────────────────────────────");
console.log(envLine("CORS_ORIGINS"));

console.log("\n── Replit / Deployment ─────────────────────");
console.log(envLine("REPLIT_DEV_DOMAIN"));
console.log(envLine("REPLIT_INTERNAL_APP_DOMAIN"));
console.log(envLine("EXPO_PUBLIC_DOMAIN"));
console.log(envLine("EXPO_PUBLIC_API_URL"));

console.log("\n── Frontend domains ────────────────────────");
console.log("  admin  : https://admin-tailorbook.yiion.com");
console.log("  api    : https://api-tailorbook.yiion.com");
console.log("");

// Detect common misconfig warnings
const warnings: string[] = [];
if (!process.env.DATABASE_URL) warnings.push("DATABASE_URL not set — using MySQL defaults (localhost:3306/tailorbook)");
if (!process.env.JWT_SECRET) warnings.push("JWT_SECRET not set — using fallback secret. Set JWT_SECRET in .env for production!");
if (process.env.JWT_SECRET === "tailorbook-dev-secret-change-me") warnings.push("JWT_SECRET is still the default value — change it for production!");
if (!process.env.SMTP_HOST) warnings.push("SMTP_HOST not set — OTP emails will not be sent");
if (!process.env.CORS_ORIGINS && process.env.NODE_ENV === "production") warnings.push("CORS_ORIGINS not set in production — CORS is permissive");

if (warnings.length > 0) {
  console.log("── WARNINGS ────────────────────────────────");
  for (const w of warnings) console.log(`  ⚠ ${w}`);
  console.log("");
}

import app from "./app";
import { bootstrapDatabase } from "./lib/bootstrap-db";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "4000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Collect every non-loopback IPv4 address so the user knows which URL to
// point their phone / other devices at.
function listLanUrls(p: number): string[] {
  const urls: string[] = [];
  for (const name of Object.keys(os.networkInterfaces())) {
    for (const info of os.networkInterfaces()[name] ?? []) {
      if (info.family === "IPv4" && !info.internal) {
        urls.push(`http://${info.address}:${p}`);
      }
    }
  }
  return urls;
}

await bootstrapDatabase();

import { smtpConfigured } from "./lib/email";
console.log(
  `[api-server] SMTP=${smtpConfigured() ? "enabled" : "disabled (demo mode — OTPs returned in devOtp)"}`,
);

// ── Unhandled exception/rejection handlers ───────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("\n🚨 UNCAUGHT EXCEPTION 🚨");
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n🚨 UNHANDLED PROMISE REJECTION 🚨");
  console.error("Reason:", reason);
  console.error("Promise:", promise);
  process.exit(1);
});

// Cleanup on exit
const cleanup = async () => {
  console.log("\n🔄 Graceful shutdown requested...");
  // Add any cleanup logic here (database connections, etc.)
  // For now, just log and exit
  console.log("✅ Shutdown complete");
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

app.listen(port, "0.0.0.0", (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      console.error(
        `\n  ✗ Port ${port} is already in use.\n` +
          `    On Windows, find the stale process with:\n` +
          `      netstat -ano | findstr :${port}\n` +
          `      taskkill /PID <pid> /F\n` +
          `    Or run with a different port:  PORT=4001 npm run dev\n`,
      );
    }
    process.exit(1);
  }

  logger.info({ port, host: "0.0.0.0" }, `Server listening on http://localhost:${port}`);
  console.log(`\n  ➜  Local:   http://localhost:${port}/api`);
  console.log(`  ➜  Health:  http://localhost:${port}/api/healthz`);
  console.log(`  ➜  Diags:   http://localhost:${port}/api/diagnostics`);
  const lan = listLanUrls(port);
  if (lan.length > 0) {
    console.log(`  ➜  Network:`);
    for (const url of lan) console.log(`     - ${url}/api`);
  }
  console.log("\n  Server ready. Use Ctrl+C to stop gracefully.\n");
});
