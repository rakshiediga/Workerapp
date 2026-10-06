"use client";
import {usePathname} from "next/navigation";
import {navigation} from "@/lib/navigation";
import {Icon} from "./Icon";
import {useAdminAuth} from "./AdminAuthProvider";
export function AdminHeader({onMenu,open}:{onMenu:()=>void;open:boolean}){const {admin}=useAdminAuth();const pathname=usePathname();const title=navigation.find(item=>pathname===item.href)?.label || "Administration";return <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 sm:px-8"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={onMenu} aria-label="Open navigation" aria-expanded={open} aria-controls="admin-mobile-navigation" className="rounded-lg border border-slate-200 p-2 lg:hidden"><Icon name="menu"/></button><div><p className="text-xs text-slate-500">Workspace</p><p className="mt-1 font-semibold">{title}</p></div></div><div className="flex items-center gap-2 text-sm text-slate-600"><span className="hidden h-8 w-8 items-center justify-center rounded-full bg-slate-100 sm:inline-flex"><Icon name="shield" className="h-4 w-4"/></span><span>{admin?.name}</span></div></header>;}
