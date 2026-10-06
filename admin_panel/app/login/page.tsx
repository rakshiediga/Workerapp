"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAdminAuth} from "@/components/admin/AdminAuthProvider";
import {AdminLoginForm} from "@/components/admin/AdminLoginForm";
export default function Login(){const {loading,isAuthenticated}=useAdminAuth();const router=useRouter();useEffect(()=>{if(!loading&&isAuthenticated)router.replace("/dashboard");},[loading,isAuthenticated,router]);if(loading||isAuthenticated)return <p role="status" className="p-8">Loading admin session...</p>;return <main className="flex min-h-screen items-center justify-center px-5 py-12"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><p className="text-lg font-bold text-teal-800">WorkerBooking</p><p className="mt-2 text-xs uppercase tracking-widest text-slate-500">Admin Panel</p><h1 className="mt-8 text-3xl font-bold">Admin Login</h1><p className="mt-3 text-sm text-slate-500">Sign in to manage WorkerBooking.</p><AdminLoginForm/></section></main>;}
