// Load .env FIRST, before any other imports that read process.env.
import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, "0.0.0.0", (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, host: "0.0.0.0" }, `Server listening on http://localhost:${port}`);
  console.log(`\n  ➜  API:  http://localhost:${port}/api`);
  console.log(`  ➜  Health:  http://localhost:${port}/api/healthz\n`);
});
