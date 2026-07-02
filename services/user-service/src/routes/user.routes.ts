import { Router } from "express";
import * as userController from "../controllers/user.controller";
import authMiddleware from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { registerSchema, loginSchema, updateProfileSchema } from "../validators/user.validator";

const router = Router();

router.post("/register", validate(registerSchema), userController.register);
router.post("/login", validate(loginSchema), userController.login);
router.get("/me", authMiddleware, userController.getProfile);
router.put("/profile", authMiddleware, validate(updateProfileSchema), userController.updateProfile);

export default router;
