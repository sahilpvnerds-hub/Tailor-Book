import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

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

export default router;
