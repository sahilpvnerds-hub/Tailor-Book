import { defineConfig } from "drizzle-kit";
import path from "path";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  `mysql://${process.env.MYSQL_USER ?? "root"}:${process.env.MYSQL_PASSWORD ?? "admin123"}@${process.env.MYSQL_HOST ?? "localhost"}:${process.env.MYSQL_PORT ?? 3306}/${process.env.MYSQL_DATABASE ?? "tailorbook"}`;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "mysql",
  dbCredentials: {
    url: DATABASE_URL,
  },
  // Print all SQL so we can copy-paste into MySQL Workbench if needed
  verbose: true,
  strict: true,
});
