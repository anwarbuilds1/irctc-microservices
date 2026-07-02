import { Router } from "express";
import healthRoutes from "./health.routes";
import rootRoutes from "./root.routes";
import userRoutes from "./user.routes";

const router = Router();

router.use("/", rootRoutes);
router.use("/health", healthRoutes);
router.use("/users", userRoutes);


export default router;
