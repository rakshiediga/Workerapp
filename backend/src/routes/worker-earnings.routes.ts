import {Router} from "express";
import {authenticate,authorizeRoles} from "../middleware/auth.middleware.js";
import {summary,history} from "../controllers/worker-earnings.controller.js";
const router=Router();
router.use(authenticate,authorizeRoles("WORKER"));
router.get("/summary",summary);
router.get("/",history);
export default router;
