import { getPrismaClient } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
export class MarketplaceError extends Error { constructor(message: string, public statusCode: number) { super(message); } }
function database() { const client = getPrismaClient(); if (!client) throw new MarketplaceError("Marketplace is temporarily unavailable.", 503); return client; }
export function slug(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 100) throw new MarketplaceError("Invalid category or service filter.", 400);
  return value;
}
const categorySelect = { id: true, name: true, slug: true, description: true, isActive: true } satisfies Prisma.CategorySelect;
const serviceSelect = { id: true, name: true, slug: true, description: true, basePrice: true, category: { select: categorySelect } } satisfies Prisma.ServiceSelect;
const activeService = { isActive: true, category: { isActive: true } };
const publicWorker = { verificationStatus: "VERIFIED" as const, user: { isActive: true, role: "WORKER" as const } };
const workerSelect = {
 id: true, bio: true, city: true, serviceArea: true, experienceYears: true, startingPrice: true, rating: true, totalReviews: true, isAvailable: true, verificationStatus: true,
 user: { select: { name: true } },
 services: { where: { service: activeService }, orderBy: { service: { name: "asc" as const } }, select: { price: true, service: { select: serviceSelect } } },
} satisfies Prisma.WorkerProfileSelect;
type WorkerRow = Prisma.WorkerProfileGetPayload<{ select: typeof workerSelect }>;
function workerDto(worker: WorkerRow) {
 const startingPrice = worker.services.reduce((minimum, offering) => offering.price.lt(minimum) ? offering.price : minimum, worker.services[0]?.price ?? new Prisma.Decimal(0));
 return { id: worker.id, name: worker.user.name, bio: worker.bio, city: worker.city, serviceArea: worker.serviceArea, experienceYears: worker.experienceYears, startingPrice: startingPrice.toFixed(2), rating: worker.rating.toFixed(2), totalReviews: worker.totalReviews, isAvailable: worker.isAvailable, verificationStatus: worker.verificationStatus,
 services: worker.services.map(({ price, service }) => ({ id: service.id, name: service.name, slug: service.slug, description: service.description, category: service.category, price: price.toFixed(2) })) };
}
export async function categories() { return database().category.findMany({ where: { isActive: true }, select: categorySelect, orderBy: [{ name: "asc" }, { id: "asc" }] }); }
export async function categoryServices(categorySlug: string) {
 const category = await database().category.findFirst({ where: { slug: categorySlug, isActive: true }, select: categorySelect });
 if (!category) throw new MarketplaceError("Category not found", 404);
 return { category, services: await services(categorySlug) };
}
export async function services(category?: string) {
 const rows = await database().service.findMany({ where: { ...activeService, ...(category ? { category: { isActive: true, slug: category } } : {}) }, select: serviceSelect, orderBy: [{ name: "asc" }, { id: "asc" }] });
 return rows.map(row => ({ ...row, basePrice: row.basePrice.toFixed(2) }));
}
export async function workers(query: { category?: unknown; service?: unknown; availability?: unknown; sort?: unknown }) {
 const category = slug(query.category), service = slug(query.service);
 if (query.availability !== undefined && query.availability !== "true" && query.availability !== "false") throw new MarketplaceError("Availability must be true or false.", 400);
 const sort = query.sort ?? "rating";
 if (sort !== "rating" && sort !== "price" && sort !== "experience") throw new MarketplaceError("Sort must be rating, price or experience.", 400);
 const orderBy: Prisma.WorkerProfileOrderByWithRelationInput[] = [sort === "price" ? { startingPrice: "asc" } : sort === "experience" ? { experienceYears: "desc" } : { rating: "desc" }, { id: "asc" }];
 const rows = await database().workerProfile.findMany({ where: { ...publicWorker,
 ...(query.availability !== undefined ? { isAvailable: query.availability === "true" } : {}),
 services: { some: { service: { ...activeService, ...(service ? { slug: service } : {}), category: { isActive: true, ...(category ? { slug: category } : {}) } } } },
 }, select: { ...workerSelect, services: { ...workerSelect.services, where: {service: {...activeService, ...(service ? {slug:service} : {}), category: {isActive:true,...(category ? {slug:category} : {})}}} } }, orderBy });
 const result = rows.filter(row => row.services.length > 0).map(workerDto);
 return sort === "price" ? result.sort((a,b) => new Prisma.Decimal(a.startingPrice).comparedTo(b.startingPrice) || a.id.localeCompare(b.id)) : result;
}
export async function worker(id: string) {
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new MarketplaceError("Worker not found", 404);
 const row = await database().workerProfile.findFirst({ where: { id, ...publicWorker, services: { some: { service: activeService } } }, select: { ...workerSelect, reviews: { orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 20, select: { id: true, rating: true, comment: true, createdAt: true, customer: { select: { name: true } } } } } });
 if (!row || !row.services.length) throw new MarketplaceError("Worker not found", 404);
 return { ...workerDto(row), reviews: row.reviews.map(review => ({ id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt, customerName: review.customer.name })) };
}
