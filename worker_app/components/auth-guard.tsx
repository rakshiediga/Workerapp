"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { getAccessToken } from "@/lib/auth-storage";
export function AuthGuard({children}: {children: ReactNode}) {
  const {user, loading, error, refreshUser} = useAuth(); const router = useRouter(); const pathname = usePathname();
  useEffect(() => { if (!loading && !user && (!error || !getAccessToken())) router.replace("/login?next=" + encodeURIComponent(pathname)); }, [user, loading, error, router, pathname]);
  if (loading) return <p role="status" className="p-8">Checking worker session...</p>;
  if (!user && error) return <div className="p-8"><p role="alert">{error}</p><button onClick={() => void refreshUser()} className="mt-4 text-teal-700">Retry</button><a href="/login" className="ml-5 text-teal-700">Worker Login</a></div>;
  return user ? children : <p className="p-8">Redirecting to login...</p>;
}
