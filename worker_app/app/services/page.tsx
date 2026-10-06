"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {WorkerSidebar} from "@/components/worker-sidebar";
import {useWorkerServices} from "@/lib/use-worker-services";
import {getEligibleServices,saveService,removeService,priceError,type EligibleService,type OfferedService} from "@/lib/worker-services";
import {useAuth} from "@/components/auth-provider";
const inputClass="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 focus:outline-teal-700";
export default function ServicesPage(){
  const {services,error,loading,reload}=useWorkerServices();const {refreshUser}=useAuth();
  const [eligible,setEligible]=useState<EligibleService[]>([]);const [eligibleError,setEligibleError]=useState("");const [eligibleLoading,setEligibleLoading]=useState(true);const [revision,setRevision]=useState(0);
  const [form,setForm]=useState<OfferedService|"new"|null>(null);const [serviceId,setServiceId]=useState("");const [price,setPrice]=useState("");const [deleting,setDeleting]=useState<string|null>(null);
  const [busy,setBusy]=useState("");const [actionError,setActionError]=useState("");const [message,setMessage]=useState("");const acting=useRef(false);
  useEffect(()=>{let active=true;queueMicrotask(()=>{if(active){setEligibleLoading(true);setEligibleError("");}});getEligibleServices().then(rows=>{if(active)setEligible(rows);}).catch(cause=>{if(active)setEligibleError(cause instanceof Error?cause.message:"Unable to load eligible services.");}).finally(()=>{if(active)setEligibleLoading(false);});return()=>{active=false;};},[revision]);
  const remaining=eligible.filter(row=>!services.some(offering=>offering.serviceId===row.id));
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(acting.current||!form)return;const validation=priceError(price);if(validation){setActionError(validation);return;}
    if(form==="new"&&!serviceId){setActionError("Select a service.");return;}
    acting.current=true;setBusy(form==="new"?"Adding...":"Updating...");setActionError("");setMessage("");
    try{await saveService(price.trim(),serviceId,form==="new"?undefined:form.id);setMessage(form==="new"?"Service added successfully":"Price updated successfully");setForm(null);reload();}
    catch(cause){setActionError(cause instanceof Error?cause.message:"Unable to save service.");}finally{acting.current=false;setBusy("");}
  }
  async function remove(id:string){
    if(acting.current)return;acting.current=true;setBusy("Removing...");setActionError("");setMessage("");
    try{await removeService(id);setDeleting(null);setMessage("Service removed successfully");reload();await refreshUser();}
    catch(cause){setActionError(cause instanceof Error?cause.message:"Unable to remove service.");}finally{acting.current=false;setBusy("");}
  }
  function open(offering:OfferedService|"new"){setForm(offering);setPrice(offering==="new"?"":offering.price);setServiceId(offering==="new"?"":offering.serviceId);setDeleting(null);setActionError("");setMessage("");}
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]"><WorkerSidebar/><main className="min-w-0 px-5 py-8 sm:px-8"><div className="mx-auto max-w-5xl">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold">My Services</h1><button disabled={!!busy||loading||!!error} onClick={()=>open("new")} className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white">+ Add Service</button></div><p className="mt-3 text-slate-600">Choose the services you provide and set your prices.</p>
    {form&&<form onSubmit={submit} noValidate className="mt-6 rounded-xl border border-teal-200 bg-white p-6"><fieldset disabled={!!busy} className="space-y-5"><legend className="mb-4 text-xl font-semibold">{form==="new"?"Add Service":`Edit Price: ${form.name}`}</legend>
      {form==="new"&&<><label htmlFor="service-id" className="block text-sm font-medium">Service<select id="service-id" value={serviceId} disabled={eligibleLoading||!!eligibleError} onChange={event=>setServiceId(event.target.value)} className={inputClass}><option value="">{eligibleLoading?"Loading services...":"Select a service"}</option>{remaining.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>{eligibleError&&<p role="alert" className="text-red-700">{eligibleError}<button type="button" onClick={()=>setRevision(value=>value+1)} className="ml-3">Retry</button></p>}{!eligibleLoading&&!eligibleError&&!remaining.length&&<p className="text-slate-600">No additional eligible services are available for your profession.</p>}</>}
      <label htmlFor="service-price" className="block text-sm font-medium">Price (₹)<input id="service-price" inputMode="decimal" value={price} maxLength={10} onChange={event=>setPrice(event.target.value)} className={inputClass}/></label>
      <div className="flex flex-wrap gap-3"><button disabled={!!busy||(form==="new"&&(eligibleLoading||!!eligibleError||!remaining.length))} className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white">{busy||(form==="new"?"Add Service":"Save Price")}</button><button type="button" onClick={()=>{setForm(null);setActionError("");}} className="rounded-lg border border-slate-300 px-5 py-3">Cancel</button></div>
    </fieldset></form>}
    {loading?<p role="status" className="mt-8">Loading services...</p>:error?<p role="alert" className="mt-8 text-red-700">{error}<button onClick={reload} className="ml-3">Retry</button></p>:!services.length?<div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center"><h2 className="text-xl font-semibold">No services added yet.</h2><p className="mt-3 text-slate-600">Add the services you provide to start receiving relevant job requests.</p></div>:<div className="mt-7 grid gap-5 sm:grid-cols-2">{services.map(offering=><article key={offering.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-6"><h2 className="break-words text-xl font-semibold">{offering.name}</h2><p className="mt-2 text-sm text-slate-500">{offering.category.name}</p><p className="mt-5 text-2xl font-bold">₹{offering.price}</p>{!offering.isActive&&<p className="mt-2 text-amber-700">This service is currently inactive.</p>}<div className="mt-5 flex flex-wrap gap-4"><button disabled={!!busy} onClick={()=>open(offering)} className="font-semibold text-teal-700">Edit Price</button><button disabled={!!busy} onClick={()=>{setDeleting(offering.id);setForm(null);}} className="font-semibold text-red-700">Remove</button></div>{deleting===offering.id&&<div className="mt-4 rounded-lg bg-red-50 p-4"><p className="font-semibold">Remove this service?</p><p className="mt-2 text-sm text-slate-600">You will no longer receive new requests for this service.</p><div className="mt-4 flex gap-4"><button disabled={!!busy} onClick={()=>void remove(offering.id)} className="font-semibold text-red-700">{busy==="Removing..."?busy:"Confirm Remove"}</button><button disabled={!!busy} onClick={()=>setDeleting(null)}>Cancel</button></div></div>}</article>)}</div>}
    {message&&<p role="status" className="mt-5 text-teal-700">{message}</p>}{actionError&&<p role="alert" className="mt-5 text-red-700">{actionError}</p>}
  </div></main></div>;
}
