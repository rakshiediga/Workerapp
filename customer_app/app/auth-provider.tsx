"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authenticate, currentUser, updateProfile, type Credentials, type Registration, type User } from "@/lib/auth";
import { authChanged, getAccessToken, removeAccessToken, setAccessToken } from "@/lib/auth-storage";
import { ApiError } from "@/lib/api";

interface AuthState {
  user: User | null; loading: boolean; isAuthenticated: boolean; error: string;
  login: (input: Credentials) => Promise<void>;
  register: (input: Registration) => Promise<void>;
  logout: () => void; refreshUser: () => Promise<void>;
  saveProfile: (input: { name: string; email: string }) => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const version = useRef(0);
  const refreshUser = useCallback(async () => {
    const attempt = ++version.current;
    setLoading(true);
    setUser(null);
    setError("");
    try {
      if (getAccessToken()) {
        const nextUser = await currentUser();
        if (attempt === version.current) setUser(nextUser);
      }
    } catch (cause) {
      if (attempt === version.current) {
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) removeAccessToken();
        setError(cause instanceof Error ? cause.message : "Unable to restore your session.");
      }
    } finally { if (attempt === version.current) setLoading(false); }
  }, []);
  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void refreshUser(); });
    const changed = () => {
      if (!getAccessToken()) { ++version.current; setUser(null); setLoading(false); }
    };
    const storage = () => { void refreshUser(); };
    window.addEventListener(authChanged, changed);
    window.addEventListener("storage", storage);
    return () => { disposed = true; window.removeEventListener(authChanged, changed); window.removeEventListener("storage", storage); };
  }, [refreshUser]);
  async function signIn(input: Credentials | Registration, registering: boolean) {
    const attempt = ++version.current;
    const token = await authenticate(input, registering);
    setAccessToken(token);
    try {
      const nextUser = await currentUser();
      if (attempt !== version.current) throw new Error("Authentication changed. Please log in again.");
      setUser(nextUser); setError(""); setLoading(false);
    } catch (cause) { if (getAccessToken() === token) removeAccessToken(); throw cause; }
  }
  function logout() { ++version.current; removeAccessToken(); setUser(null); setError(""); setLoading(false); router.push("/login"); }
  async function saveProfile(input: { name: string; email: string }) {
    const attempt = version.current;
    const updated = await updateProfile(input);
    if (attempt !== version.current || !getAccessToken()) throw new Error("Your session changed. Please log in again.");
    setUser(updated);
  }
  return <AuthContext.Provider value={{ user, loading, error, isAuthenticated: !!user, login: (input) => signIn(input, false), register: (input) => signIn(input, true), logout, refreshUser, saveProfile }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requires AuthProvider.");
  return context;
}
