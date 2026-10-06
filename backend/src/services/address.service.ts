import { Prisma } from "../generated/prisma/client.js";
import { getPrismaClient } from "../lib/prisma.js";
export class AddressError extends Error { constructor(message: string, public statusCode: number) { super(message); } }
export type AddressInput = { label: string; houseFlat: string; streetArea: string; landmark: string | null; city: string; state: string; pincode: string };
const fields = ["label", "houseFlat", "streetArea", "landmark", "city", "state", "pincode"] as const;
const select = { id: true, label: true, houseFlat: true, streetArea: true, landmark: true, city: true, state: true, pincode: true, latitude: true, longitude: true, isDefault: true } satisfies Prisma.AddressSelect;
const orderBy = [{ isDefault: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];
function database() { const client = getPrismaClient(); if (!client) throw new AddressError("Address service is temporarily unavailable.", 503); return client; }
function id(value: unknown) { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new AddressError("Address not found", 404); return value; }
export function validateAddress(value: unknown, partial: true): Partial<AddressInput>;
export function validateAddress(value: unknown, partial?: false): AddressInput;
export function validateAddress(value: unknown, partial = false): Partial<AddressInput> {
 if (!value || typeof value !== "object" || Array.isArray(value)) throw new AddressError("A valid JSON address is required.", 400);
 const body = value as Record<string, unknown>;
 if (!Object.keys(body).length || Object.keys(body).some(key => !fields.includes(key as typeof fields[number]))) throw new AddressError("Only address fields may be changed. Use the default endpoint to change defaults.", 400);
 const result: Partial<AddressInput> = {};
 for (const field of fields) {
  if (partial && !(field in body)) continue;
  const raw = body[field];
  if (field === "landmark" && (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim()))) { result.landmark = null; continue; }
  const max = field === "label" ? 30 : field === "pincode" ? 6 : ["houseFlat", "city", "state"].includes(field) ? 100 : 150;
  if (typeof raw !== "string" || !raw.trim() || raw.trim().length > max) throw new AddressError(`Enter a valid ${field} (maximum ${max} characters).`, 400);
  result[field] = raw.trim();
 }
 if (result.pincode !== undefined && !/^\d{6}$/.test(result.pincode)) throw new AddressError("Pincode must contain exactly 6 digits.", 400);
 return result;
}
// Lock the parent customer row, including when they have no addresses yet.
// All address mutations use this same lock, preventing concurrent first creates,
// default changes and deletions from leaving multiple defaults. No schema change.
async function mutation<T>(userId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
 return database().$transaction(async tx => {
  const owned = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid AND "role" = 'CUSTOMER' AND "isActive" = true FOR UPDATE`);
  if (!owned.length) throw new AddressError("This customer account cannot manage addresses.", 403);
  return action(tx);
 });
}
export async function addresses(userId: string) { return database().address.findMany({ where: { userId }, select, orderBy }); }
export async function createAddress(userId: string, input: AddressInput) {
 return mutation(userId, async tx => {
  const count = await tx.address.count({ where: { userId } });
  return tx.address.create({ data: { ...input, userId, isDefault: count === 0 }, select });
 });
}
export async function updateAddress(userId: string, value: unknown, input: Partial<AddressInput>) {
 const addressId = id(value);
 return mutation(userId, async tx => {
  const result = await tx.address.updateMany({ where: { id: addressId, userId }, data: input });
  if (!result.count) throw new AddressError("Address not found", 404);
  return tx.address.findFirst({ where: { id: addressId, userId }, select });
 });
}
export async function defaultAddress(userId: string, value: unknown) {
 const addressId = id(value);
 return mutation(userId, async tx => {
  const owned = await tx.address.findFirst({ where: { id: addressId, userId }, select: { id: true } });
  if (!owned) throw new AddressError("Address not found", 404);
  await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  await tx.address.updateMany({ where: { id: addressId, userId }, data: { isDefault: true } });
  return tx.address.findFirst({ where: { id: addressId, userId }, select });
 });
}
export async function deleteAddress(userId: string, value: unknown) {
 const addressId = id(value);
 return mutation(userId, async tx => {
  const owned = await tx.address.findFirst({ where: { id: addressId, userId }, select: { isDefault: true } });
  if (!owned) throw new AddressError("Address not found", 404);
  await tx.address.deleteMany({ where: { id: addressId, userId } });
  if (owned.isDefault) {
   const replacement = await tx.address.findFirst({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } });
   if (replacement) {
    await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    await tx.address.updateMany({ where: { id: replacement.id, userId }, data: { isDefault: true } });
   }
  }
 });
}
