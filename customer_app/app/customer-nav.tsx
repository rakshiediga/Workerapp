"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

export function CustomerNav() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const links = user ? [["/", "Home"], ["/services", "Services"], ["/bookings", "My Bookings"], ["/profile", "Profile"]] : [["/", "Home"], ["/services", "Services"]];
  return <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-5 text-sm font-medium sm:gap-8">
    {links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`rounded hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 ${pathname === href ? "text-blue-600 underline underline-offset-8" : ""}`}>{label}</Link>)}
    {loading ? <span role="status">Checking session...</span> : user ? <button type="button" onClick={logout} className="rounded text-blue-600 hover:text-blue-800">Logout</button> : <Link href="/login" className="rounded bg-blue-600 px-4 py-2 text-white">Login</Link>}
  </nav>;
}
