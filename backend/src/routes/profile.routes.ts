import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
import * as controller from "../controllers/profile.controller.js";
const router = Router();
router.use(authenticate, authorizeRoles("CUSTOMER"));
router.get("/", controller.get);
router.patch("/", controller.update);
export default router;
