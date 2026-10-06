const KEY = "workerbooking_admin_token";
export const SESSION_CLEARED = "admin-session-cleared";
// MVP matches the other apps. Production should prefer a secure HttpOnly cookie/session.
export function getToken() { try { return typeof window === "undefined" ? null : localStorage.getItem(KEY); } catch { return null; } }
export function setToken(token:string) { localStorage.setItem(KEY,token); }
export function clearToken() { try { localStorage.removeItem(KEY); } catch { /* Storage can be unavailable in restricted browsers. */ } finally { window.dispatchEvent(new Event(SESSION_CLEARED)); } }
export function isAdminStorageKey(key:string|null) { return key === KEY || key === null; }
