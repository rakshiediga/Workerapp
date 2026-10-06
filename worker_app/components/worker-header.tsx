"use client";
import Link from "next/link";
import { useAuth } from "./auth-provider";
export function WorkerHeader() {
  const {user, loading, logout} = useAuth();
  return <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
    <Link href="/" className="text-xl font-bold tracking-tight text-teal-800">WorkerBooking <span className="ml-2 inline-block rounded-full bg-teal-50 px-2 py-1 align-middle text-xs font-medium text-teal-700">Worker Portal</span></Link>
    <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm font-semibold">{loading ? <span>Checking session...</span> : user ? <><Link href="/dashboard" className="hover:text-teal-700">Dashboard</Link><button onClick={logout} className="text-teal-700">Logout</button></> : <><Link href="/login" className="hover:text-teal-700">Worker Login</Link><Link href="/register" className="rounded-lg bg-teal-700 px-4 py-2.5 text-white hover:bg-teal-800">Join as a Worker</Link></>}</nav>
  </div></header>;
}
