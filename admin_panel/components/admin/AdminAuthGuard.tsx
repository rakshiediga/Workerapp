"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAdminAuth} from "./AdminAuthProvider";
export function AdminAuthGuard({children}:{children:React.ReactNode}){const {loading,isAuthenticated}=useAdminAuth();const router=useRouter();useEffect(()=>{if(!loading&&!isAuthenticated)router.replace("/login");},[loading,isAuthenticated,router]);if(loading||!isAuthenticated)return <p role="status" className="p-8 text-slate-600">Loading admin session...</p>;return children;}
