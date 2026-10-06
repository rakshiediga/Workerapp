import { randomUUID } from "node:crypto";
import { Prisma, type BookingStatus } from "../generated/prisma/client.js";
import { getPrismaClient } from "../lib/prisma.js";

export class BookingError extends Error {
  constructor(message: string, public statusCode: number) { super(message); }
}
const statuses = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const slots = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function database() {
  const client = getPrismaClient();
  if (!client) throw new BookingError("Booking service is temporarily unavailable.", 503);
  return client;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BookingError("A valid JSON booking request is required.", 400);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 150): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new BookingError(`Enter a valid ${label} (maximum ${max} characters).`, 400);
  return value.trim();
}
function optionalText(value: unknown, label: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, label, max);
}
// This application currently schedules Indian local calendar dates. PostgreSQL
// DATE stores the day; bookingTime is a validated Asia/Kolkata HH:mm slot.
export function indiaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validateBooking(value: unknown, now = new Date()) {
  const body = object(value);
  for (const field of ["customerId", "customerPhone", "status", "bookingNumber"]) {
    if (field in body) throw new BookingError(`${field} is controlled by the server.`, 400);
  }
  // Ignore client-supplied price. Only WorkerService.price is authoritative.
  if (typeof body.workerId !== "string" || !uuid.test(body.workerId)) throw new BookingError("Worker not found", 404);
  if (typeof body.serviceId !== "string" || !uuid.test(body.serviceId)) throw new BookingError("Select a valid service.", 400);
  const date = body.bookingDate;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BookingError("Select a valid booking date.", 400);
  const parsed = new Date(date + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < indiaToday(now)) throw new BookingError("Select today or a future booking date.", 400);
  if (typeof body.bookingTime !== "string" || !slots.includes(body.bookingTime)) throw new BookingError("Select a valid booking time slot.", 400);
  const address = object(body.address);
  const pincode = text(address.pincode, "6-digit pincode", 6);
  if (!/^\d{6}$/.test(pincode)) throw new BookingError("Pincode must contain exactly 6 digits.", 400);
  return {
    workerId: body.workerId, serviceId: body.serviceId, bookingDate: parsed, bookingTime: body.bookingTime,
    address: { label: optionalText(address.label, "address label", 30) || "Other", houseFlat: text(address.houseFlat, "house / flat number", 100), streetArea: text(address.streetArea, "street / area"), landmark: optionalText(address.landmark, "landmark", 150), city: text(address.city, "city", 100), state: text(address.state, "state", 100), pincode },
    problemDescription: optionalText(body.problemDescription, "problem description", 1000),
  };
}
export function validateStatus(value: unknown): BookingStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !statuses.includes(value as BookingStatus)) throw new BookingError("Invalid booking status filter.", 400);
  return value as BookingStatus;
}
function bookingNumber(value: unknown): string {
  if (typeof value !== "string" || !/^WB[0-9A-F]{40}$/.test(value)) throw new BookingError("Booking not found", 404);
  return value;
}
const select = {
  bookingNumber: true, status: true, bookingDate: true, bookingTime: true, price: true,
  addressLabel: true, houseFlat: true, streetArea: true, landmark: true, city: true, state: true, pincode: true,
  customerPhone: true, problemDescription: true, createdAt: true,
  worker: { select: { id: true, user: { select: { name: true } } } },
  service: { select: { id: true, name: true, category: { select: { id: true, name: true, slug: true } } } },
  statusHistory: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }], select: { status: true, createdAt: true, reason: true, changedBy: { select: { role: true } } } },
} satisfies Prisma.BookingSelect;
type Row = Prisma.BookingGetPayload<{ select: typeof select }>;
function dto(row: Row) {
  return {
    bookingNumber: row.bookingNumber, status: row.status, worker: { id: row.worker.id, name: row.worker.user.name }, service: row.service,
    bookingDate: row.bookingDate.toISOString().slice(0, 10), bookingTime: row.bookingTime, price: row.price.toFixed(2),
    address: { label: row.addressLabel, houseFlat: row.houseFlat, streetArea: row.streetArea, landmark: row.landmark, city: row.city, state: row.state, pincode: row.pincode },
    customerPhone: row.customerPhone, problemDescription: row.problemDescription, createdAt: row.createdAt.toISOString(),
    statusHistory: row.statusHistory.map(item => ({ status: item.status, createdAt: item.createdAt.toISOString(), reason: item.reason ?? null, actor: item.changedBy?.role ?? null })),
  };
}
export async function createBooking(customerId: string, input: ReturnType<typeof validateBooking>) {
  // TODO: Add production-grade request idempotency before scaling booking writes.
  const row = await database().$transaction(async tx => {
    const customer = await tx.user.findFirst({ where: { id: customerId, role: "CUSTOMER", isActive: true }, select: { phone: true } });
    if (!customer) throw new BookingError("This customer account cannot create bookings.", 403);
    const worker = await tx.workerProfile.findFirst({ where: { id: input.workerId, verificationStatus: "VERIFIED", user: { role: "WORKER", isActive: true } }, select: { isAvailable: true } });
    if (!worker) throw new BookingError("Worker not found", 404);
    if (!worker.isAvailable) throw new BookingError("This worker is currently unavailable.", 400);
    const offering = await tx.workerService.findFirst({ where: { workerId: input.workerId, serviceId: input.serviceId, service: { isActive: true, category: { isActive: true } } }, select: { price: true } });
    if (!offering) throw new BookingError("This worker does not offer the selected active service.", 400);
    const address = input.address;
    return tx.booking.create({ data: {
      bookingNumber: `WB${indiaToday().replaceAll("-", "")}${randomUUID().replaceAll("-", "").toUpperCase()}`,
      customerId, workerId: input.workerId, serviceId: input.serviceId, bookingDate: input.bookingDate, bookingTime: input.bookingTime,
      price: offering.price, status: "REQUESTED", customerPhone: customer.phone, problemDescription: input.problemDescription,
      addressLabel: address.label, houseFlat: address.houseFlat, streetArea: address.streetArea, landmark: address.landmark, city: address.city, state: address.state, pincode: address.pincode,
      statusHistory: { create: { status: "REQUESTED", changedByUserId: customerId } },
    }, select });
  });
  return dto(row);
}
export async function myBookings(customerId: string, status?: BookingStatus) {
  const rows = await database().booking.findMany({ where: { customerId, ...(status ? { status } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select });
  return rows.map(dto);
}
export async function bookingDetails(customerId: string, number: unknown) {
  const row = await database().booking.findFirst({ where: { customerId, bookingNumber: bookingNumber(number) }, select });
  if (!row) throw new BookingError("Booking not found", 404);
  return dto(row);
}
export async function cancelBooking(customerId: string, number: unknown) {
  const validNumber = bookingNumber(number);
  const row = await database().$transaction(async tx => {
    const owned = await tx.booking.findFirst({ where: { customerId, bookingNumber: validNumber }, select: { id: true } });
    if (!owned) throw new BookingError("Booking not found", 404);
    // Conditional UPDATE acquires the row lock and rechecks REQUESTED, so a
    // concurrent cancellation/status change cannot produce a second history row.
    const updated = await tx.booking.updateMany({ where: { id: owned.id, customerId, status: "REQUESTED" }, data: { status: "CANCELLED" } });
    if (updated.count !== 1) throw new BookingError("Only Requested bookings can be cancelled.", 409);
    await tx.bookingStatusHistory.create({ data: { bookingId: owned.id, status: "CANCELLED", changedByUserId: customerId } });
    const booking = await tx.booking.findFirst({ where: { id: owned.id, customerId }, select });
    if (!booking) throw new BookingError("Booking not found", 404);
    return booking;
  });
  return dto(row);
}
