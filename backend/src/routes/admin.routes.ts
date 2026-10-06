import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
const router = Router();
router.use(authenticate, authorizeRoles("ADMIN"));
router.get("/health", (_request,response) => response.json({success:true,message:"Admin access confirmed"}));
export default router;
