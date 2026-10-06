import {pageNumber} from "../lib/pagination.js";
export {pageNumber} from "../lib/pagination.js";
import {earningsSummary} from "./worker-earnings.service.js";
import {Prisma} from "../generated/prisma/client.js";
import {getPrismaClient} from "../lib/prisma.js";
import {AuthError} from "../types/auth.types.js";
const select = {
  bookingNumber: true, status: true, bookingDate: true, bookingTime: true, price: true,
  addressLabel: true, houseFlat: true, streetArea: true, landmark: true, city: true, state: true, pincode: true,
  problemDescription: true, createdAt: true,
  service: {select: {id: true, name: true}}, customer: {select: {name: true}},
  statusHistory: {
    select: {status: true, createdAt: true, reason: true, changedBy: {select: {role: true}}},
    orderBy: [{createdAt: "asc"}, {id: "asc"}],
  },
} satisfies Prisma.BookingSelect;
const detailSelect = {...select, customerPhone: true} satisfies Prisma.BookingSelect;
type Row = Prisma.BookingGetPayload<{select: typeof select}> & {customerPhone?: string};
function database() {
  const client = getPrismaClient();
  if (!client) throw new AuthError(503, "Job requests are temporarily unavailable.");
  return client;
}
function dto(row: Row) {
  return {
    bookingNumber: row.bookingNumber, status: row.status, service: row.service, customer: row.customer,
    bookingDate: row.bookingDate.toISOString().slice(0, 10), bookingTime: row.bookingTime, price: row.price.toFixed(2),
    address: {label: row.addressLabel, houseFlat: row.houseFlat, streetArea: row.streetArea, landmark: row.landmark, city: row.city, state: row.state, pincode: row.pincode},
    problemDescription: row.problemDescription, createdAt: row.createdAt.toISOString(),
    // Keep the booking contact snapshot available during and after assigned jobs.
    ...(["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(row.status) && row.customerPhone ? {customerPhone: row.customerPhone} : {}),
    statusHistory: row.statusHistory.map(entry => ({status: entry.status, createdAt: entry.createdAt.toISOString(), reason: entry.reason ?? null, actor: entry.changedBy?.role ?? null})),
  };
}
// Booking.workerId references WorkerProfile.id; every query constrains JWT ownership.
function owned(userId: string): Prisma.BookingWhereInput {
  return {worker: {userId, user: {role: "WORKER", isActive: true}}};
}
function number(value: unknown) {
  if (typeof value !== "string" || !/^WB[0-9A-F]{40}$/.test(value)) throw new AuthError(404, "Job request not found");
  return value;
}
const orderBy = [{createdAt: "desc" as const}, {id: "desc" as const}];
export async function jobRequests(userId: string) {
  return (await database().booking.findMany({where: {...owned(userId), status: "REQUESTED"}, select, orderBy})).map(dto);
}
const jobStatuses = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export function jobStatus(value: unknown): typeof jobStatuses[number][] | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.split(",").some(status => !jobStatuses.includes(status as typeof jobStatuses[number]))) throw new AuthError(400, "Invalid job status filter.");
  return [...new Set(value.split(","))] as typeof jobStatuses[number][];
}
const historyOrder = [{updatedAt: "desc" as const}, {id: "desc" as const}];
export async function workerJobs(userId: string, status?: typeof jobStatuses[number][], page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > 2147483647) throw new AuthError(400, "Invalid pagination parameters.");
  const where = {...owned(userId), status: {in: status ?? [...jobStatuses]}};
  return database().$transaction(async tx => {
    const [rows, total] = await Promise.all([tx.booking.findMany({where, select, orderBy: historyOrder, skip, take: limit}), tx.booking.count({where})]);
    return {jobs: rows.map(dto), pagination: {page, limit, total, totalPages: Math.ceil(total / limit)}};
  }, {isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead});
}
export async function workerDashboard(userId: string) {
  const requested: Prisma.BookingWhereInput = {...owned(userId), status: "REQUESTED"};
  const active: Prisma.BookingWhereInput = {...owned(userId), status: {in: ["ACCEPTED", "IN_PROGRESS"]}};
  const completed: Prisma.BookingWhereInput = {...owned(userId), status: "COMPLETED"};
  const cancelled: Prisma.BookingWhereInput = {...owned(userId), status: "CANCELLED"};
  return database().$transaction(async tx => {
    const [newRequests, activeJobs, completedJobs, cancelledJobs, requests, jobs, earnings] = await Promise.all([
      tx.booking.count({where: requested}), tx.booking.count({where: active}), tx.booking.count({where: completed}), tx.booking.count({where: cancelled}),
      tx.booking.findMany({where: requested, select, orderBy, take: 3}), tx.booking.findMany({where: active, select, orderBy: historyOrder, take: 3}), earningsSummary(userId,tx),
    ]);
    return {newRequests, activeJobs, completedJobs, cancelledJobs, todayGrossEarnings:earnings.todayGrossEarnings, timezone:earnings.timezone, previews: {requests: requests.map(dto), active: jobs.map(dto)}};
  }, {isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead});
}
export async function jobRequest(userId: string, value: unknown) {
  const row = await database().booking.findFirst({where: {...owned(userId), status: "REQUESTED", bookingNumber: number(value)}, select});
  if (!row) throw new AuthError(404, "Job request not found");
  return dto(row);
}
export async function jobDetails(userId: string, value: unknown) {
  const row = await database().booking.findFirst({where: {...owned(userId), bookingNumber: number(value)}, select: detailSelect});
  if (!row) throw new AuthError(404, "Job request not found");
  return dto(row);
}
export function actionReason(body: unknown, reject: boolean): string | null {
  if (body === undefined) return null;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AuthError(400, "Invalid job action request.");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !reject || key !== "reason")) throw new AuthError(400, "Unsupported job action field.");
  if (input.reason === undefined) return null;
  if (typeof input.reason !== "string" || input.reason.trim().length > 500) throw new AuthError(400, "Reason must be text of at most 500 characters.");
  return input.reason.trim() || null;
}
const transitions = {
  accept: {from: "REQUESTED", to: "ACCEPTED"},
  reject: {from: "REQUESTED", to: "CANCELLED"},
  start: {from: "ACCEPTED", to: "IN_PROGRESS"},
  complete: {from: "IN_PROGRESS", to: "COMPLETED"},
} as const;
export type JobAction = keyof typeof transitions;
export async function transitionJob(userId: string, value: unknown, action: JobAction, reason: string | null) {
  const bookingNumber = number(value);
  const transition = transitions[action];
  return database().$transaction(async tx => {
    // PostgreSQL locks/rechecks the conditional UPDATE. Competing actions and
    // REQUESTED-only customer cancellation can win once, never both.
    const changed = await tx.booking.updateMany({where: {...owned(userId), bookingNumber, status: transition.from}, data: {status: transition.to}});
    const row = await tx.booking.findFirst({where: {...owned(userId), bookingNumber}, select: {id: true}});
    if (!row) throw new AuthError(404, "Job request not found");
    if (changed.count !== 1) throw new AuthError(409, action === "accept" || action === "reject" ? "This job request is no longer available." : "This job has already changed status.");
    await tx.bookingStatusHistory.create({data: {bookingId: row.id, status: transition.to, changedByUserId: userId, reason: action === "reject" ? reason : null}});
    const updated = await tx.booking.findFirst({where: {...owned(userId), bookingNumber}, select: detailSelect});
    if (!updated) throw new AuthError(404, "Job request not found");
    return dto(updated);
  });
}
