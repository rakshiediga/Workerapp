import { getAccessToken, removeAccessToken } from "./auth-storage";

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function apiFetch<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid API path.");
  const token = authenticated ? getAccessToken() : null;
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try { response = await fetch(`${baseUrl}${path}`, { ...options, headers, cache: "no-store", signal: options.signal ?? AbortSignal.timeout(15000) }); }
  catch { throw new ApiError("Unable to connect to the server. Please try again.", 0); }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token && getAccessToken() === token) removeAccessToken();
    const safeMessage = data && typeof data === "object" && "message" in data && typeof data.message === "string" ? data.message : "Please try again.";
    throw new ApiError(response.status >= 500 ? "The server is temporarily unavailable. Please try again." : token && response.status === 401 ? "Your session has expired. Please log in again." : safeMessage, response.status);
  }
  if (!data) throw new ApiError("The server returned an unexpected response. Please try again.", 502);
  return data as T;
}
