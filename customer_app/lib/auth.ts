import { apiFetch, ApiError } from "./api";

export interface User {
  id: string; name: string; phone: string; email: string | null;
  role: "CUSTOMER" | "WORKER" | "ADMIN"; isActive: boolean;
  createdAt?: string;
}
export interface Credentials { phone: string; password: string }
export interface Registration extends Credentials { name: string; email?: string }
export interface AuthResponse { success: true; message: string; data: { user: User; accessToken: string } }
export interface CurrentUserResponse { success: true; data: { user: User } }

export function customerUser(user: User): User {
  if (!user || typeof user.id !== "string" || typeof user.name !== "string" || typeof user.phone !== "string" || !(user.email === null || typeof user.email === "string")) throw new ApiError("The server returned an unexpected user response.", 502);
  if (user.role !== "CUSTOMER" || !user.isActive) throw new ApiError("This account cannot access the customer app.", 403);
  return user;
}
export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f]/.test(value)) return "/services";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u001f]/.test(decoded)) return "/services";
    const url = new URL(value, "https://customer.invalid");
    if (url.origin !== "https://customer.invalid" || /^\/(login|register)(\/|$)/.test(url.pathname)) return "/services";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/services"; }
}
export async function authenticate(input: Credentials | Registration, register = false) {
  const response = await apiFetch<AuthResponse>(register ? "/api/auth/register/customer" : "/api/auth/login", { method: "POST", body: JSON.stringify(input) }, false);
  customerUser(response.data?.user);
  if (typeof response.data.accessToken !== "string" || !response.data.accessToken) throw new ApiError("The server returned an unexpected authentication response.", 502);
  return response.data.accessToken;
}
export async function currentUser() {
  const response = await apiFetch<CurrentUserResponse>("/api/auth/me");
  return customerUser(response.data?.user);
}
export async function updateProfile(input: { name: string; email: string }) {
  const response = await apiFetch<CurrentUserResponse>("/api/profile", { method: "PATCH", body: JSON.stringify(input) });
  return customerUser(response.data?.user);
}
