// Load .env FIRST, before any other imports that read process.env.
import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

// Helpful log so we know which .env was loaded.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(
  `[api-server] Starting — NODE_ENV=${process.env.NODE_ENV ?? "undefined"}`,
);
console.log(
  `[api-server] DATABASE_URL=${process.env.DATABASE_URL ? "set" : "NOT SET (will use defaults)"}`,
);

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
  const lan = listLanUrls(port);
  if (lan.length > 0) {
    console.log(`  ➜  Network:`);
    for (const url of lan) console.log(`     - ${url}/api`);
  }
  console.log();
});
