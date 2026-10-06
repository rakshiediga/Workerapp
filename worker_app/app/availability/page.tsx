"use client";
import Link from "next/link";
import {useRef,useState} from "react";
import {useAuth} from "@/components/auth-provider";
import {WorkerSidebar} from "@/components/worker-sidebar";
import {useWorkerServices} from "@/lib/use-worker-services";
export default function AvailabilityPage(){
  const {workerProfile,changeAvailability}=useAuth();const {services,loading,error,reload}=useWorkerServices();const [busy,setBusy]=useState(false);const [actionError,setActionError]=useState("");const acting=useRef(false);
  async function toggle(){if(acting.current||!workerProfile)return;acting.current=true;setBusy(true);setActionError("");try{await changeAvailability(!workerProfile.isAvailable);}catch(cause){setActionError(cause instanceof Error?cause.message:"Unable to update availability.");}finally{acting.current=false;setBusy(false);}}
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]"><WorkerSidebar/><main className="min-w-0 px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl"><h1 className="text-3xl font-bold">Availability</h1><section className="mt-7 rounded-xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold">Available for Jobs</h2><p className={`mt-4 text-2xl font-bold ${workerProfile?.isAvailable?"text-teal-700":"text-slate-600"}`}>{workerProfile?.isAvailable?"Available":"Unavailable"}</p><p className="mt-3 leading-7 text-slate-600">{workerProfile?.isAvailable?"You are available to receive new job requests.":"You will not receive new job requests while unavailable."}</p>
    {workerProfile?.isAvailable&&workerProfile.verificationStatus!=="VERIFIED"&&<p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Your availability is on, but customers can book you only after verification is approved.</p>}
    {loading?<p role="status" className="mt-5">Loading services...</p>:error?<p role="alert" className="mt-5 text-red-700">{error}<button onClick={reload} className="ml-3">Retry</button></p>:!services.some(service=>service.isActive)&&<p className="mt-5 text-slate-600">Add at least one active service before turning availability on. <Link href="/services" className="font-semibold text-teal-700">Manage Services</Link></p>}
    <button role="switch" aria-checked={!!workerProfile?.isAvailable} disabled={busy||loading||!!error||(!workerProfile?.isAvailable&&!services.some(service=>service.isActive))} onClick={()=>void toggle()} className="mt-6 rounded-lg bg-teal-700 px-6 py-3 font-semibold text-white">{busy?"Updating availability...":workerProfile?.isAvailable?"Turn OFF":"Turn ON"}</button>
    {actionError&&<p role="alert" className="mt-5 text-red-700">{actionError}</p>}
  </section></div></main></div>;
}
