export interface Category { id: string; name: string; slug: string; description: string | null; isActive: boolean }
export interface WorkerService { id: string; name: string; slug: string; description: string | null; category: Category; price: string }
export interface PublicWorker {
 id: string; name: string; bio: string | null; experienceYears: number; startingPrice: string; rating: string; totalReviews: number; isAvailable: boolean; verificationStatus: "VERIFIED";
 services: WorkerService[];
}
export interface WorkerDetail extends PublicWorker { reviews: { id: string; rating: number; comment: string | null; createdAt: string; customerName: string }[] }
export interface MarketplaceResponse<T> { success: true; data: T }
export function profession(worker: PublicWorker) { return [...new Set(worker.services.map(service => service.category.name))].join(", ") || "Service professional"; }
// Preserve decimal strings for money; no floating-point price calculation.
export function money(value: string | number) { return `\u20b9${value}`; }
