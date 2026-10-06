"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user && !error) router.replace(`/login?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [loading, user, error, router, pathname]);
  if (loading) return <p role="status" className="p-8">Checking your session...</p>;
  if (!user) return error ? <div className="p-8"><p role="alert">{error}</p><Link className="mt-4 inline-block text-blue-600" href={`/login?next=${encodeURIComponent(pathname)}`}>Log in again</Link></div> : <p role="status" className="p-8">Redirecting to login...</p>;
  return children;
}
