import { Prisma } from "../generated/prisma/client.js";
import { getPrismaClient } from "../lib/prisma.js";
import { safeUserSelect } from "./auth.service.js";
import { AuthError } from "../types/auth.types.js";

const profileSelect = { id: true, bio: true, experienceYears: true, city: true, serviceArea: true, startingPrice: true, rating: true, totalReviews: true, isAvailable: true, verificationStatus: true, primaryCategory: { select: { id: true, name: true, slug: true } } } satisfies Prisma.WorkerProfileSelect;
function database() { const client = getPrismaClient(); if (!client) throw new AuthError(503, "Worker profile service is unavailable."); return client; }
function dto(profile: Prisma.WorkerProfileGetPayload<{select: typeof profileSelect}>) {
  return { ...profile, startingPrice: profile.startingPrice.toFixed(2), rating: profile.rating.toFixed(2) };
}
export async function getWorkerProfile(userId: string) {
  const result = await database().user.findUnique({ where: {id: userId}, select: {...safeUserSelect, workerProfile: {select: profileSelect}} });
  if (!result || result.role !== "WORKER" || !result.isActive) throw new AuthError(403, "Worker access is required.");
  if (!result.workerProfile) throw new AuthError(404, "Worker profile not found");
  const {workerProfile, ...user} = result;
  return {user, workerProfile: dto(workerProfile)};
}
export function validateWorkerProfile(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthError(400, "A JSON request body is required.");
  const body = value as Record<string, unknown>;
  const allowed = ["name", "email", "bio", "experienceYears", "city", "serviceArea", "startingPrice"];
  if (!Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) throw new AuthError(400, "Only editable profile fields may be updated.");
  const user: Prisma.UserUpdateManyMutationInput = {};
  const profile: Prisma.WorkerProfileUpdateManyMutationInput = {};
  for (const key of ["name", "city"] as const) if (body[key] !== undefined) {
    if (typeof body[key] !== "string" || !body[key].trim() || body[key].trim().length > 100) throw new AuthError(400, `${key === "name" ? "Name" : "City"} is required and must not exceed 100 characters.`);
    if (key === "name") user.name = body[key].trim(); else profile.city = body[key].trim();
  }
  if (body.email !== undefined) {
    if (body.email !== null && typeof body.email !== "string") throw new AuthError(400, "Enter a valid email address.");
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new AuthError(400, "Enter a valid email address.");
    user.email = email;
  }
  for (const [key, maximum] of [["bio", 1000], ["serviceArea", 200]] as const) if (body[key] !== undefined) {
    if (body[key] !== null && typeof body[key] !== "string") throw new AuthError(400, `${key} must be text.`);
    const text = typeof body[key] === "string" ? body[key].trim() || null : null;
    if (text && text.length > maximum) throw new AuthError(400, `${key} must not exceed ${maximum} characters.`);
    profile[key] = text;
  }
  if (body.experienceYears !== undefined) {
    if (typeof body.experienceYears !== "number" || !Number.isInteger(body.experienceYears) || body.experienceYears < 0 || body.experienceYears > 60) throw new AuthError(400, "Experience must be an integer between 0 and 60.");
    profile.experienceYears = body.experienceYears;
  }
  if (body.startingPrice !== undefined) {
    if (typeof body.startingPrice !== "string" || !/^\d{1,10}(?:\.\d{1,2})?$/.test(body.startingPrice.trim())) throw new AuthError(400, "Starting price must be a non-negative amount with at most two decimal places.");
    profile.startingPrice = new Prisma.Decimal(body.startingPrice.trim());
  }
  return {user, profile};
}
export async function updateWorkerProfile(userId: string, input: ReturnType<typeof validateWorkerProfile>) {
  try {
    return await database().$transaction(async tx => {
      const user = await tx.user.findUnique({where: {id: userId}, select: {...safeUserSelect, workerProfile: {select: {id: true}}}});
      if (!user || user.role !== "WORKER" || !user.isActive) throw new AuthError(403, "Worker access is required.");
      if (!user.workerProfile) throw new AuthError(404, "Worker profile not found");
      const updatedUser = await tx.user.update({where: {id: userId}, data: input.user, select: safeUserSelect});
      const updatedProfile = await tx.workerProfile.update({where: {userId}, data: input.profile, select: profileSelect});
      return {user: updatedUser, workerProfile: dto(updatedProfile)};
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AuthError(409, "Email is already in use");
    throw error;
  }
}
