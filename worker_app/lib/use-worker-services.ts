"use client";
import {useCallback,useEffect,useState} from "react";
import {useAuth} from "@/components/auth-provider";
import {getServices,type OfferedService} from "./worker-services";
export function useWorkerServices(){
  const {user}=useAuth();const [revision,setRevision]=useState(0);
  const key=`${user?.id||""}:${revision}`;
  const [result,setResult]=useState<{key:string;services:OfferedService[];error:string}|null>(null);
  useEffect(()=>{let active=true;if(user) getServices().then(services=>{if(active)setResult({key,services,error:""});}).catch(cause=>{if(active)setResult({key,services:[],error:cause instanceof Error?cause.message:"Unable to load services."});});return()=>{active=false;};},[user,key]);
  const reload=useCallback(()=>setRevision(value=>value+1),[]);
  return {services:result?.key===key?result.services:[],error:result?.key===key?result.error:"",loading:!user||result?.key!==key,reload};
}
