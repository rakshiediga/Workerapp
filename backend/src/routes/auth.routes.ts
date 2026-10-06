import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { loginController, meController, registerCustomerController, registerWorkerController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Single-process development limits. Use a shared store when deploying replicas.
const registrationLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  message: { success: false, message: "Too many registration attempts. Please try again later." } });
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." } });

router.post("/register/customer", registrationLimit, registerCustomerController);
router.post("/register/worker", registrationLimit, registerWorkerController);
router.post("/login", loginLimit, loginController);
router.get("/me", authenticate, meController);

export default router;
