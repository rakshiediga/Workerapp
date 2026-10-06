import { Prisma } from "../generated/prisma/client.js";
import { getPrismaClient } from "../lib/prisma.js";
import { hashPassword, validateRegistration } from "./auth.service.js";
import { AuthError } from "../types/auth.types.js";
export function adminCredentials(env: NodeJS.ProcessEnv) {
  const input = validateRegistration({name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, phone: env.ADMIN_PHONE, password: env.ADMIN_PASSWORD});
  if (!input.email) throw new AuthError(400, "ADMIN_EMAIL is required.");
  if (input.password.length < 12 || !/[A-Z]/.test(input.password) || !/[a-z]/.test(input.password) || !/[0-9]/.test(input.password)) throw new AuthError(400, "Admin password must have at least 12 characters with uppercase, lowercase and a number.");
  return {...input, email: input.email};
}
export async function createAdmin(input: ReturnType<typeof adminCredentials>) {
  const db = getPrismaClient();
  if (!db) throw new AuthError(503, "Configure DATABASE_URL before creating an admin account.");
  const existing = await db.user.findMany({where: {OR: [{email: input.email}, {phone: input.phone}]}, select: {email:true,phone:true,role:true}});
  if (existing.length) {
    if (existing.length === 1 && existing[0]?.role === "ADMIN" && existing[0].email === input.email && existing[0].phone === input.phone) return "Admin account already exists.";
    throw new AuthError(409, "Email or phone is already used by an account. No account was changed.");
  }
  try {
    await db.user.create({data: {name:input.name,email:input.email,phone:input.phone,passwordHash:await hashPassword(input.password),role:"ADMIN",isActive:true},select:{id:true}});
    return "Admin account created successfully.";
  } catch(error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AuthError(409, "Email or phone is already used by an account. No account was changed.");
    throw error;
  }
}
