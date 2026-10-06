import type { Request, Response } from "express";
import { getPrismaClient } from "../lib/prisma.js";

export async function getHealth(_request: Request, response: Response): Promise<void> {
  let database = "not_configured";
  try {
    const prisma = getPrismaClient();
    if (prisma) {
      await prisma.$queryRaw`SELECT 1`;
      database = "connected";
    }
  } catch {
    // Keep API liveness available without leaking connection details.
    database = "unavailable";
  }
  response.json({ success: true, message: "Worker Booking API is running", database });
}
