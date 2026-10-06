"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authenticate, currentSession, updateWorkerProfile, updateAvailability, type ProfileInput, type Credentials, type Registration, type User, type WorkerProfile } from "@/lib/auth";
import { authChanged, getAccessToken, removeAccessToken, setAccessToken } from "@/lib/auth-storage";
import { ApiError } from "@/lib/api";
interface AuthState { user: User | null; workerProfile: WorkerProfile | null; loading: boolean; error: string; isAuthenticated: boolean; login: (input: Credentials) => Promise<void>; register: (input: Registration) => Promise<void>; logout: () => void; refreshUser: (quiet?:boolean) => Promise<void>; saveProfile: (input: ProfileInput) => Promise<void>; changeAvailability:(isAvailable:boolean)=>Promise<void> }
const Context = createContext<AuthState | null>(null);
export function AuthProvider({children}: {children: ReactNode}) {
  const router = useRouter();
  const [session, setSession] = useState<{user: User; workerProfile: WorkerProfile} | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const version = useRef(0);
  const refreshUser = useCallback(async (quiet=false) => {
    const attempt = ++version.current; if(!quiet){setLoading(true);setSession(null);} setError("");
    try { if (getAccessToken()) { const next = await currentSession(); if (attempt === version.current) setSession(next); } }
    catch (cause) { if (attempt === version.current) { if (cause instanceof ApiError && [401,403,404].includes(cause.status)) removeAccessToken(); setError(cause instanceof Error ? cause.message : "Unable to restore session."); } }
    finally { if (attempt === version.current) setLoading(false); }
  }, []);
  useEffect(() => {
    let disposed = false; queueMicrotask(() => { if (!disposed) void refreshUser(); });
    const changed = () => { if (!getAccessToken()) { ++version.current; setSession(null); setLoading(false); } };
    const storage = (event: StorageEvent) => { if (event.key === "workerBooking.workerAccessToken" || event.key === null) void refreshUser(); };
    window.addEventListener(authChanged, changed); window.addEventListener("storage", storage);
    return () => { disposed = true; window.removeEventListener(authChanged, changed); window.removeEventListener("storage", storage); };
  }, [refreshUser]);
  async function signIn(input: Credentials | Registration, registering: boolean) {
    const attempt = ++version.current;
    const token = await authenticate(input, registering); setAccessToken(token);
    try { const next = await currentSession(); if (attempt !== version.current) throw new Error("Your session changed. Please log in again."); setSession(next); setLoading(false); setError(""); }
    catch (cause) { if (getAccessToken() === token) removeAccessToken(); throw cause; }
  }
  function logout() { ++version.current; removeAccessToken(); setSession(null); setLoading(false); setError(""); router.push("/login"); }
  async function saveProfile(input: ProfileInput) {const attempt = version.current; const next = await updateWorkerProfile(input); if (attempt !== version.current || !getAccessToken()) throw new Error("Your session changed. Please log in again."); setSession(next);}
  async function changeAvailability(isAvailable:boolean){const attempt=version.current;const next=await updateAvailability(isAvailable);if(attempt!==version.current||!getAccessToken())throw new Error("Your session changed. Please log in again.");setSession(next);}
  return <Context.Provider value={{user: session?.user ?? null, workerProfile: session?.workerProfile ?? null, loading, error, isAuthenticated: !!session, login: input => signIn(input, false), register: input => signIn(input, true), logout, refreshUser, saveProfile, changeAvailability}}>{children}</Context.Provider>;
}
export function useAuth() { const context = useContext(Context); if (!context) throw new Error("AuthProvider is required."); return context; }
