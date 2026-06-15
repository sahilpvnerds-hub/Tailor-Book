// Load .env from the api-server directory if available, otherwise from process.env.
// We import dotenv lazily here so the library can also be used in environments
// where the caller has already loaded .env (e.g. via tsx, docker, etc.).
import path from "node:path";
import fs from "node:fs";

try {
  // Look for .env starting from cwd, walking up at most 4 levels.
  const candidates = [
    process.cwd() + "/.env",
    process.cwd() + "/../.env",
    process.cwd() + "/../../.env",
    process.cwd() + "/../../../.env",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const dotenv = await import("dotenv");
      dotenv.config({ path: c });
      break;
    }
  }
} catch {
  // dotenv not available — caller will pass env via process.env
}

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------
// We accept either a `DATABASE_URL` (mysql://user:pass@host:port/db) or the
// individual MYSQL_* environment variables. The api-server sets DATABASE_URL
// in its .env, so this works out of the box.
//
// In dev: mysql://root:admin123@localhost:3306/tailorbook
// ---------------------------------------------------------------------------
function getConnectionConfig() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.MYSQL_HOST ?? "localhost";
  const port = Number(process.env.MYSQL_PORT ?? 3306);
  const user = process.env.MYSQL_USER ?? "root";
  const password = process.env.MYSQL_PASSWORD ?? "admin123";
  const database = process.env.MYSQL_DATABASE ?? "tailorbook";
  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

const connectionString = getConnectionConfig();

// Reuse a single pool across hot-reloads / multiple imports
declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: mysql.Pool | undefined;
}

export const pool =
  global.__mysqlPool ??
  mysql.createPool({
    uri: connectionString,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true, // convert DECIMAL → number (not string)
    dateStrings: false,
    timezone: "Z",
  });

if (process.env.NODE_ENV !== "production") {
  global.__mysqlPool = pool;
}

export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
