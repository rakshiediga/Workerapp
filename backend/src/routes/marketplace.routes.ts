import { Router } from "express";
import * as controller from "../controllers/marketplace.controller.js";
const router = Router();
router.get("/categories", controller.categories);
router.get("/categories/:slug/services", controller.categoryServices);
router.get("/services", controller.services);
router.get("/workers", controller.workers);
router.get("/workers/:id", controller.worker);
export default router;
