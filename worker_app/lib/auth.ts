import { apiFetch, ApiError } from "./api";
export interface User { id: string; name: string; phone: string; email: string | null; role: "WORKER" | "CUSTOMER" | "ADMIN"; isActive: boolean }
export interface WorkerProfile { id: string; city: string | null; serviceArea: string | null; bio: string | null; experienceYears: number; startingPrice: string; rating: string; totalReviews: number; primaryCategory: { id: string; name: string; slug: string } | null; isAvailable: boolean; verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED" }
export interface ProfileInput {name: string; email: string; bio: string; experienceYears: number; city: string; serviceArea: string; startingPrice: string}
export interface WorkerSession {user: User; workerProfile: WorkerProfile}
export const verificationLabels = {PENDING: "Pending Verification", VERIFIED: "Verified", REJECTED: "Verification Rejected", SUSPENDED: "Suspended"};
export function profileCompletion(user: User | null, profile: WorkerProfile | null) {
  const basic = !!(user?.name && user.phone && profile?.primaryCategory && profile.city);
  const professional = basic && !!(profile?.bio?.trim() && profile.serviceArea?.trim()) && Number.isInteger(profile?.experienceYears) && (profile?.experienceYears ?? -1) >= 0;
  return {basic, professional, percentage: (Number(basic) + Number(professional)) * 50};
}
export interface Credentials { phone: string; password: string }
export interface Registration extends Credentials { name: string; city: string; profession: string }
export function workerUser(user: User) {
  if (!user || user.role !== "WORKER" || !user.isActive) throw new ApiError("This account is not registered as a worker.", 403);
  return user;
}
export async function authenticate(input: Credentials | Registration, registering: boolean) {
  const result = await apiFetch<{data: {user: User; accessToken: string}}>(registering ? "/api/auth/register/worker" : "/api/auth/login", {method: "POST", body: JSON.stringify(input)}, false);
  workerUser(result.data?.user);
  if (!result.data.accessToken) throw new ApiError("The server returned an unexpected response.", 502);
  return result.data.accessToken;
}
export async function currentSession() {
  const result = await apiFetch<{data: WorkerSession}>("/api/worker/profile");
  return {user: workerUser(result.data.user), workerProfile: result.data.workerProfile};
}
export async function updateWorkerProfile(input: ProfileInput) {
  const result = await apiFetch<{data: WorkerSession}>("/api/worker/profile", {method: "PATCH", body: JSON.stringify(input)});
  return {user: workerUser(result.data.user), workerProfile: result.data.workerProfile};
}
export async function updateAvailability(isAvailable:boolean){
  await apiFetch("/api/worker/availability",{method:"PATCH",body:JSON.stringify({isAvailable})});
  return currentSession();
}
export function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f]/.test(value)) return "/dashboard";
  try { const decoded = decodeURIComponent(value); if (decoded.startsWith("//") || /[\\\u0000-\u001f]/.test(decoded)) return "/dashboard"; const url = new URL(value, "https://worker.invalid"); return url.origin === "https://worker.invalid" && !/^\/(login|register)(\/|$)/.test(url.pathname) ? url.pathname + url.search + url.hash : "/dashboard"; } catch { return "/dashboard"; }
}
