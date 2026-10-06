// TODO: use secure HttpOnly cookies/session architecture for production.
const key = "workerBooking.workerAccessToken";
export const authChanged = "worker-auth-changed";
export function getAccessToken() { if (typeof window === "undefined") return null; try { return localStorage.getItem(key); } catch { return null; } }
export function setAccessToken(token: string) { localStorage.setItem(key, token); window.dispatchEvent(new Event(authChanged)); }
export function removeAccessToken() { if (typeof window === "undefined") return; try { localStorage.removeItem(key); } catch {} window.dispatchEvent(new Event(authChanged)); }
