import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(helmet());
app.use(compression());

// Global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes).
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use(limiter);

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

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// CORS — allow all origins in development, lock down in production
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin (Postman, curl, mobile apps)
      if (!origin) return callback(null, true);

      // Check if in development mode - be more permissive
      if (process.env.NODE_ENV === 'development') {
        // Allow localhost on any port
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
        if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);

        // Allow all yiion.com domains
        // Allow all yiion.com domains safely
        if (origin.endsWith('.yiion.com') || origin === 'https://yiion.com') return callback(null, true);

        // Allow LAN IPs for development
        if (/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)) return callback(null, true);
        if (/^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)) return callback(null, true);
        if (/^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin)) return callback(null, true);

        // Allow in production for domains in .env
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In development, allow everything else (for easier testing)
        return callback(null, true);
      }

      // In production - strict mode
      // Allow localhost for testing
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);

      // Allow allowed origins from .env
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow yiion.com domains safely
      if (origin.endsWith('.yiion.com') || origin === 'https://yiion.com') return callback(null, true);

      // Otherwise deny
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
