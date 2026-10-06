"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAdminAuth} from "@/components/admin/AdminAuthProvider";
export default function Home(){const {loading,isAuthenticated}=useAdminAuth();const router=useRouter();useEffect(()=>{if(!loading)router.replace(isAuthenticated?"/dashboard":"/login");},[loading,isAuthenticated,router]);return <p role="status" className="p-8">Loading admin session...</p>;}
