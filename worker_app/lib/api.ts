import { getAccessToken, removeAccessToken } from "./auth-storage";
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function apiFetch<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid API path.");
  const token = authenticated ? getAccessToken() : null;
  const headers = new Headers(options.headers); headers.set("Accept", "application/json");
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try { response = await fetch(API_BASE_URL + path, { ...options, headers, cache: "no-store", signal: options.signal ?? AbortSignal.timeout(15000) }); }
  catch { throw new ApiError("Unable to connect to the server. Please try again.", 0); }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token && getAccessToken() === token) removeAccessToken();
    throw new ApiError(response.status >= 500 ? "The server is temporarily unavailable. Please try again." : response.status === 401 && token ? "Your session has expired. Please log in again." : typeof data?.message === "string" ? data.message : "Please try again.", response.status);
  }
  if (!data) throw new ApiError("The server returned an unexpected response.", 502);
  return data as T;
}
