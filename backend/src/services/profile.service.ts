import { Prisma } from "../generated/prisma/client.js";
import { getPrismaClient } from "../lib/prisma.js";
import { AuthError } from "../types/auth.types.js";
import { getCurrentUser, safeUserSelect } from "./auth.service.js";

export const getProfile = getCurrentUser;

export function validateProfile(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthError(400, "A JSON request body is required.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !["name", "email"].includes(key))) throw new AuthError(400, "Only name and email may be updated.");
  if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 100) throw new AuthError(400, "Name must contain between 2 and 100 characters.");
  let email: string | null | undefined;
  if (body.email !== undefined) {
    if (body.email !== null && typeof body.email !== "string") throw new AuthError(400, "Enter a valid email address.");
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new AuthError(400, "Enter a valid email address.");
  }
  return { name: body.name.trim(), ...(email !== undefined ? { email } : {}) };
}

export async function updateProfile(userId: string, input: ReturnType<typeof validateProfile>) {
  const prisma = getPrismaClient();
  if (!prisma) throw new AuthError(503, "Profile service is unavailable.");
  try {
    // The unique email constraint also protects concurrent updates.
    const result = await prisma.user.updateMany({ where: { id: userId, role: "CUSTOMER", isActive: true }, data: input });
    if (!result.count) throw new AuthError(403, "This account cannot update a customer profile.");
    return await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: safeUserSelect });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AuthError(409, "Email is already in use");
    throw error;
  }
}
