import {Router} from "express";
import {authenticate,authorizeRoles} from "../middleware/auth.middleware.js";
import * as controller from "../controllers/worker-job.controller.js";
const router=Router();router.use(authenticate,authorizeRoles("WORKER"));
router.get("/",controller.list);router.get("/:bookingNumber",controller.details);
router.patch("/:bookingNumber/accept",controller.accept);
router.patch("/:bookingNumber/reject",controller.reject);
export default router;
