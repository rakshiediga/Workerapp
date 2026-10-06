import workerVerificationRoutes from "./routes/worker-verification.routes.js";
import workerEarningsRoutes from "./routes/worker-earnings.routes.js";
import addressRoutes from "./routes/address.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import { AddressError } from "./services/address.service.js";
import bookingRoutes from "./routes/booking.routes.js";
import { BookingError } from "./services/booking.service.js";
import marketplaceRoutes from "./routes/marketplace.routes.js";
import { MarketplaceError } from "./services/marketplace.service.js";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { authenticate, authorizeRoles } from "./middleware/auth.middleware.js";
import { AuthError } from "./types/auth.types.js";
import workerProfileRoutes from "./routes/worker-profile.routes.js";
import workerServicesRoutes from "./routes/worker-services.routes.js";
import workerJobRoutes from "./routes/worker-job.routes.js";
import workerJobsRoutes from "./routes/worker-jobs.routes.js";

import workerDashboardRoutes from "./routes/worker-dashboard.routes.js";
import adminRoutes from "./routes/admin.routes.js";
const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || (process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL || "" : `${process.env.FRONTEND_URL || "http://localhost:3000"},http://localhost:3001,http://localhost:3002`)).split(",").map(origin => origin.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)) }));
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({ success: true, message: "Worker Booking API" });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", marketplaceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/worker/profile", workerProfileRoutes);
app.use("/api/worker/job-requests", workerJobRoutes);
app.use("/api/worker/jobs", workerJobsRoutes);
app.use("/api/worker/dashboard", workerDashboardRoutes);
app.use("/api/worker/earnings", workerEarningsRoutes);
app.use("/api/worker/verification", workerVerificationRoutes);
app.use("/api/worker", workerServicesRoutes);
app.get("/api/customer/test", authenticate, authorizeRoles("CUSTOMER"), (_request, response) => {
  response.json({ success: true, message: "Customer protected route" });
});

app.use((_request, response) => {
  response.status(404).json({ success: false, message: "Route not found" });
});

const handleError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof AuthError || error instanceof MarketplaceError || error instanceof BookingError || error instanceof AddressError) {
    response.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.parse.failed") {
    response.status(400).json({ success: false, message: "Invalid JSON request body." });
    return;
  }
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    response.status(413).json({ success: false, message: "Request body is too large." });
    return;
  }
  response.status(500).json({ success: false, message: "An unexpected server error occurred." });
};
app.use(handleError);

export default app;
