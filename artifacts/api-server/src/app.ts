import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — allow Expo dev server, React Native, and the local web client.
// In dev we want to be permissive; in prod you'd lock this down to your
// known domains.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, server-to-server, native fetch)
      if (!origin) return callback(null, true);

      // Allow localhost on any port, http or https (web dev / preview)
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);

      // Allow Expo dev server (expo.dev, replit, etc.)
      if (/^https?:\/\/.*\.expo\.dev$/.test(origin)) return callback(null, true);
      // Replit deployment domains (covers *.repl.co, *.replit.dev,
      // *.id.repl.co, and any other *.replit.* subdomain)
      if (/^https?:\/\/.*\.repl\.co$/.test(origin)) return callback(null, true);
      if (/^https?:\/\/.*\.replit\.dev$/.test(origin)) return callback(null, true);
      if (/^https?:\/\/.*\.replit\.app$/.test(origin)) return callback(null, true);
      if (/^https?:\/\/.*\.repl\.com$/.test(origin)) return callback(null, true);

      // Allow LAN IPs (for physical devices connecting to dev server)
      if (/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)) return callback(null, true);
      if (/^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)) return callback(null, true);
      if (/^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin)) return callback(null, true);

      // Lock down everything else
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api", router);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "Unhandled API error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
