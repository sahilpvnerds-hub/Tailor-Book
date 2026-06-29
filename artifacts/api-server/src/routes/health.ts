import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";

const router: IRouter = Router();

// --- GET /api  (root: human-friendly landing) ----------------------------
router.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Tailor Book API",
    version: "0.1.0",
    status: "running",
    endpoints: {
      health: "GET  /api/healthz",
      login: "POST /api/auth/login   { emailOrMobile, password }",
      register: "POST /api/auth/register  { name, email, mobile, password, ... }",
      me: "GET  /api/auth/me       (auth: Bearer token)",
      logout: "POST /api/auth/logout   (auth: Bearer token)",
      customers:
        "GET  /api/customers  |  POST /api/customers   (auth)",
      measurements:
        "GET  /api/measurements?customerId  |  POST /api/measurements   (auth)",
      invoices:
        "GET  /api/invoices  |  POST /api/invoices   (auth)",
      admin: "GET  /api/admin/users   (admin only)",
    },
  });
});

// --- GET /api/healthz ----------------------------------------------------
router.get("/healthz", (_req: Request, res: Response) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// --- GET /api/health/db ----------------------------------------------------
router.get("/db", async (_req: Request, res: Response) => {
  try {
    // Test database connection and check tables
    const [tables] = await db.execute("SHOW TABLES");
    const [orderCount] = await db.execute("SELECT COUNT(*) as count FROM orders");

    // Check if delivery_status column exists
    let hasDeliveryStatus = false;
    try {
      const [cols] = await db.execute("SHOW COLUMNS FROM order_items LIKE 'delivery_status'");
      hasDeliveryStatus = Array.isArray(cols) && cols.length > 0;
    } catch {
      hasDeliveryStatus = false;
    }

    res.json({
      status: "ok",
      tables: Array.isArray(tables) ? tables.length : 0,
      orders: (orderCount as any)[0]?.count ?? 0,
      hasDeliveryStatusColumn: hasDeliveryStatus
    });
  } catch (error) {
    console.error("DB health check failed:", error);
    res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
