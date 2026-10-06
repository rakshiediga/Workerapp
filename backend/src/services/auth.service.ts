import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { getPrismaClient } from "../lib/prisma.js";
import { AuthError, type AuthUser, type LoginInput, type RegisterCustomerInput } from "../types/auth.types.js";

export const safeUserSelect = { id: true, name: true, phone: true, email: true, role: true, isActive: true, createdAt: true } satisfies Prisma.UserSelect;
export function hashPassword(password: string) { return bcrypt.hash(password, 12); }
const invalidCredentials = "Invalid phone number or password";
let dummyHash: Promise<string> | undefined;

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthError(400, "A JSON request body is required.");
  return value as Record<string, unknown>;
}

function validatePhone(value: unknown): string {
  if (typeof value !== "string") throw new AuthError(400, "Phone number must contain exactly 10 digits.");
  const phone = value.trim().replace(/[\s()-]/g, "");
  if (!/^\d{10}$/.test(phone)) throw new AuthError(400, "Phone number must contain exactly 10 digits.");
  return phone;
}

function validatePassword(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length < 8) throw new AuthError(400, "Password must contain at least 8 characters.");
  // bcrypt truncates beyond 72 UTF-8 bytes; reject rather than silently truncate.
  if (Buffer.byteLength(value, "utf8") > 72) throw new AuthError(400, "Password must not exceed 72 bytes.");
  return value;
}

export function validateRegistration(value: unknown): RegisterCustomerInput {
  const body = bodyObject(value);
  if (typeof body.name !== "string" || !body.name.trim()) throw new AuthError(400, "Name is required.");
  if (body.name.trim().length > 100) throw new AuthError(400, "Name must not exceed 100 characters.");
  let email: string | undefined;
  if (body.email !== undefined && body.email !== null) {
    if (typeof body.email !== "string") throw new AuthError(400, "Enter a valid email address.");
    email = body.email.trim().toLowerCase() || undefined;
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new AuthError(400, "Enter a valid email address.");
  }
  return { name: body.name.trim(), phone: validatePhone(body.phone), email, password: validatePassword(body.password) };
}

export function validateLogin(value: unknown): LoginInput {
  const body = bodyObject(value);
  if (body.email !== undefined) {
    if (body.phone !== undefined || typeof body.email !== "string") throw new AuthError(400, "Provide either email or phone.");
    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError(401, "Invalid credentials.");
    return { email, password: validatePassword(body.password) };
  }
  return { phone: validatePhone(body.phone), password: validatePassword(body.password) };
}

function jwtConfig() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32 || secret === "replace_with_a_long_random_secret") {
    throw new AuthError(503, "Authentication is not configured.");
  }
  const expiry = process.env.JWT_EXPIRES_IN ?? "7d";
  const match = /^([1-9]\d*)(s|m|h|d|w)?$/.exec(expiry);
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  const expiresIn = match ? Number(match[1]) * (units[match[2] || "s"] ?? 0) : 0;
  if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0) throw new AuthError(503, "Authentication is not configured.");
  return { secret, expiresIn };
}

function database() {
  const prisma = getPrismaClient();
  if (!prisma) throw new AuthError(503, "Authentication service is unavailable.");
  return prisma;
}

function accessToken(user: { id: string; role: AuthUser["role"] }, config: ReturnType<typeof jwtConfig>) {
  return jwt.sign({ userId: user.id, role: user.role }, config.secret, { algorithm: "HS256", expiresIn: config.expiresIn });
}

export function validateWorkerRegistration(value: unknown) {
  const body = bodyObject(value);
  if (Object.keys(body).some(key => !["name", "phone", "profession", "city", "password"].includes(key))) throw new AuthError(400, "Unsupported worker registration fields.");
  const common = validateRegistration({ name: body.name, phone: body.phone, password: body.password });
  if (typeof body.profession !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.profession.trim()) || body.profession.trim().length > 100) throw new AuthError(400, "Invalid profession");
  if (typeof body.city !== "string" || !body.city.trim() || body.city.trim().length > 100) throw new AuthError(400, "City is required and must not exceed 100 characters.");
  return { ...common, profession: body.profession.trim(), city: body.city.trim() };
}

export async function registerWorker(input: ReturnType<typeof validateWorkerRegistration>) {
  const config = jwtConfig();
  const prisma = database();
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async tx => {
      if (await tx.user.findUnique({ where: { phone: input.phone }, select: { id: true } })) throw new AuthError(409, "An account with this phone number already exists");
      const category = await tx.category.findFirst({ where: { slug: input.profession, isActive: true }, select: { id: true } });
      if (!category) throw new AuthError(400, "Invalid profession");
      const user = await tx.user.create({ data: { name: input.name, phone: input.phone, passwordHash, role: "WORKER", isActive: true }, select: safeUserSelect });
      const workerProfile = await tx.workerProfile.create({ data: { userId: user.id, city: input.city, primaryCategoryId: category.id, bio: null, experienceYears: 0, startingPrice: 0, rating: 0, totalReviews: 0, isAvailable: false, verificationStatus: "PENDING" }, select: workerIdentitySelect });
      return { user, workerProfile, accessToken: accessToken(user, config) };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AuthError(409, "An account with this phone number already exists");
    throw error;
  }
}

const workerIdentitySelect = { id: true, city: true, verificationStatus: true, isAvailable: true, primaryCategory: { select: { id: true, name: true, slug: true } } } satisfies Prisma.WorkerProfileSelect;

export function verifyAccessToken(token: string): AuthUser {
  const config = jwtConfig();
  try {
    const payload = jwt.verify(token, config.secret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.userId) ||
      !["CUSTOMER", "WORKER", "ADMIN"].includes(payload.role) || typeof payload.exp !== "number") {
      throw new Error("Invalid token payload");
    }
    return { userId: payload.userId, role: payload.role as AuthUser["role"] };
  } catch {
    throw new AuthError(401, "Invalid or expired access token");
  }
}

export async function registerCustomer(input: RegisterCustomerInput) {
  const config = jwtConfig();
  const prisma = database();
  const duplicatePhone = await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } });
  if (duplicatePhone) throw new AuthError(409, "Phone number is already registered.");
  if (input.email) {
    const duplicateEmail = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (duplicateEmail) throw new AuthError(409, "Email address is already registered.");
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const user = await prisma.user.create({
      data: { name: input.name, phone: input.phone, email: input.email ?? null, passwordHash, role: "CUSTOMER", isActive: true },
      select: safeUserSelect,
    });
    return { user, accessToken: accessToken(user, config) };
  } catch (error) {
    // Unique constraints also protect concurrent registration requests.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AuthError(409, "Phone number or email address is already registered.");
    throw error;
  }
}

export async function login(input: LoginInput) {
  const config = jwtConfig();
  const user = await database().user.findUnique({ where: input.email !== undefined ? { email: input.email } : { phone: input.phone }, select: { ...safeUserSelect, passwordHash: true } });
  dummyHash ??= bcrypt.hash(randomBytes(32).toString("hex"), 12);
  const matches = await bcrypt.compare(input.password, user?.passwordHash || await dummyHash);
  if (!user || !user.isActive || !user.passwordHash || !matches) throw new AuthError(401, input.email !== undefined ? "Invalid credentials." : invalidCredentials);
  const safeUser = { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role, isActive: user.isActive };
  return { user: safeUser, accessToken: accessToken(safeUser, config) };
}

export async function getCurrentUser(userId: string) {
  const user = await database().user.findUnique({ where: { id: userId }, select: safeUserSelect });
  if (!user) throw new AuthError(401, "Invalid or expired access token");
  if (!user.isActive) throw new AuthError(403, "This account is inactive.");
  return user;
}
