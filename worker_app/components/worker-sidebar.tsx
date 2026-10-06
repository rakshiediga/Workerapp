"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
const navigation = [["/dashboard", "Dashboard"], ["/job-requests", "Job Requests"], ["/jobs", "My Jobs"], ["/services", "Services"], ["/availability", "Availability"], ["/earnings", "Earnings"], ["/profile", "Profile"], ["/verification", "Verification"]];
export function WorkerSidebar() {
  const pathname = usePathname();
  return <aside className="border-b border-slate-200 bg-white p-5 lg:border-r lg:border-b-0"><Link href="/" className="text-xl font-bold text-teal-800">WorkerBooking</Link><p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Worker Portal</p><nav aria-label="Dashboard navigation" className="mt-6 flex flex-wrap gap-2 lg:flex-col">{navigation.map(([href,label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-sm font-medium ${pathname === href ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}>{label}</Link>)}</nav></aside>;
}
