// Load .env from the api-server directory if available, otherwise from process.env.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

try {
  let currentDir = "";
  try {
    currentDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {}

  // Look for .env starting from cwd, walking up, or relative to the executing file.
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
    path.resolve(process.cwd(), "..", "..", "..", ".env"),
    path.resolve(process.cwd(), "artifacts/api-server/.env"),
  ];

  if (currentDir) {
    candidates.push(
      path.resolve(currentDir, ".env"),
      path.resolve(currentDir, "..", ".env"),
      path.resolve(currentDir, "..", "..", ".env"),
      path.resolve(currentDir, "..", "..", "..", ".env"),
      path.resolve(currentDir, "..", "..", "..", "..", ".env"),
    );
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      dotenv.config({ path: c });
      break;
    }
  }
} catch {
  // dotenv not available or load failed — caller will pass env via process.env
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
