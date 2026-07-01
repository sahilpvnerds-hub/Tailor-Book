import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import customersRouter from "./customers";
import measurementsRouter from "./measurements";
import invoicesRouter from "./invoices";
import ordersRouter from "./orders";
import adminRouter from "./admin";
import productTypesRouter from "./product-types";
import familyMembersRouter from "./family-members";
import customFieldsRouter from "./custom-fields";
import notificationsRouter from "./notifications";
import diagnosticsRouter from "./diagnostics";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/customers", customersRouter);
router.use("/measurements", measurementsRouter);
router.use("/invoices", invoicesRouter);
router.use("/orders", ordersRouter);
router.use("/admin", adminRouter);
router.use("/product-types", productTypesRouter);
router.use("/family-members", familyMembersRouter);
router.use("/custom-fields", customFieldsRouter);
router.use("/notifications", notificationsRouter);
router.use("/diagnostics", diagnosticsRouter);

export default router;
