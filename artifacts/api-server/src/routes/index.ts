import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import customersRouter from "./customers";
import measurementsRouter from "./measurements";
import invoicesRouter from "./invoices";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/customers", customersRouter);
router.use("/measurements", measurementsRouter);
router.use("/invoices", invoicesRouter);
router.use("/admin", adminRouter);

export default router;
