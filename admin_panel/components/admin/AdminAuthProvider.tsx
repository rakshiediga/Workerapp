"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {apiFetch,ApiError} from "@/lib/api";
import {getToken,setToken,clearToken,SESSION_CLEARED,isAdminStorageKey} from "@/lib/auth-storage";
export interface Admin {id:string;name:string;email:string|null;phone:string;role:"ADMIN";isActive:boolean}
function requireAdmin(user:Admin){if(!user||user.role!=="ADMIN"||!user.isActive)throw new ApiError("This account does not have administrator access.",403);return user;}
interface Auth {admin:Admin|null;loading:boolean;isAuthenticated:boolean;login:(email:string,password:string)=>Promise<void>;logout:()=>void;refreshAdmin:()=>Promise<void>}
const Context=createContext<Auth|null>(null);
export function AdminAuthProvider({children}:{children:React.ReactNode}){
 const [admin,setAdmin]=useState<Admin|null>(null),[loading,setLoading]=useState(true);const version=useRef(0);const router=useRouter();
 const cancelRequests=useCallback(()=>{version.current++;},[]);
 const invalidate=useCallback(()=>{version.current++;setAdmin(null);setLoading(false);},[]);
 const refreshAdmin=useCallback(async()=>{const current=++version.current;await Promise.resolve();if(current!==version.current)return;if(!getToken()){setAdmin(null);setLoading(false);return;}setLoading(true);try{const result=await apiFetch<{data:{user:Admin}}>("/api/auth/me");const user=requireAdmin(result.data.user);if(current===version.current)setAdmin(user);}catch{if(current===version.current){clearToken();setAdmin(null);}}finally{if(current===version.current)setLoading(false);}},[]);
 useEffect(()=>{const cleared=()=>invalidate();const storage=(e:StorageEvent)=>{if(isAdminStorageKey(e.key))void refreshAdmin();};window.addEventListener(SESSION_CLEARED,cleared);window.addEventListener("storage",storage);let mounted=true;void Promise.resolve().then(()=>{if(mounted)void refreshAdmin();});return()=>{mounted=false;cancelRequests();window.removeEventListener(SESSION_CLEARED,cleared);window.removeEventListener("storage",storage);};},[invalidate,refreshAdmin,cancelRequests]);
 async function login(email:string,password:string){clearToken();const current=++version.current;try{const result=await apiFetch<{data:{user:Admin;accessToken:string}}>("/api/auth/login",{method:"POST",body:JSON.stringify({email,password})},false);requireAdmin(result.data.user);if(typeof result.data.accessToken!=="string"||!result.data.accessToken)throw new ApiError("The server returned an unexpected response.",502);if(current!==version.current)throw new ApiError("Sign-in was cancelled. Please try again.",0);setToken(result.data.accessToken);const me=await apiFetch<{data:{user:Admin}}>("/api/auth/me");const user=requireAdmin(me.data.user);if(current!==version.current)throw new ApiError("Sign-in was cancelled. Please try again.",0);setAdmin(user);setLoading(false);router.replace("/dashboard");}catch(error){if(current===version.current)clearToken();throw error;}}
 function logout(){clearToken();invalidate();router.replace("/login");}
 return <Context.Provider value={{admin,loading,isAuthenticated:!!admin,login,logout,refreshAdmin}}>{children}</Context.Provider>;
}
export function useAdminAuth(){const value=useContext(Context);if(!value)throw new Error("AdminAuthProvider is required.");return value;}
