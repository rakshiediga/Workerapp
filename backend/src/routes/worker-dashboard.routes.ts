import {Router} from "express";
import {authenticate, authorizeRoles} from "../middleware/auth.middleware.js";
import {dashboard} from "../controllers/worker-job.controller.js";
const router = Router();
router.get("/", authenticate, authorizeRoles("WORKER"), dashboard);
export default router;
