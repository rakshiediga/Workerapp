const key = "workerBooking.accessToken";
export const authChanged = "workerBooking:auth";

// TODO: Replace JavaScript-accessible JWT storage with a secure HttpOnly
// cookie/session architecture before production. Never store passwords here.
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(key); } catch { return null; }
}
export function setAccessToken(token: string) {
  try { localStorage.setItem(key, token); }
  catch { throw new Error("Browser storage is unavailable. Enable it and try again."); }
  window.dispatchEvent(new Event(authChanged));
}
export function removeAccessToken() {
  try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
  window.dispatchEvent(new Event(authChanged));
}
