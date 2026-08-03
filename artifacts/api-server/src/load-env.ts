import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const candidates = [
    // Check relative to current file (works for dev src/ and prod dist/)
    path.resolve(__dirname, ".env"),
    path.resolve(__dirname, "..", ".env"),
    path.resolve(__dirname, "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", ".env"),
    // Check relative to process.cwd()
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
    path.resolve(process.cwd(), "..", "..", "..", ".env"),
    path.resolve(process.cwd(), "artifacts", "api-server", ".env"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      dotenv.config({ path: c });
      break;
    }
  }
} catch (err) {
  // Silent fallback if load fails
}
