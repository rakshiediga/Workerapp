"use client";
import {WorkerSidebar} from "@/components/worker-sidebar";
import {JobRequestCard} from "@/components/job-request-card";
import {useWorkerJobs,useWorkerDashboard} from "@/lib/use-job-requests";
import {useState} from "react";
const filters={Active:"ACCEPTED,IN_PROGRESS",Completed:"COMPLETED",Cancelled:"CANCELLED"};
export default function JobsPage() {
  const [tab,setTab]=useState<keyof typeof filters>("Active");
  const [page,setPage]=useState(1);
  const jobs=useWorkerJobs(filters[tab],page);
  const summary=useWorkerDashboard();
  const counts={Active:summary.data?.activeJobs,Completed:summary.data?.completedJobs,Cancelled:summary.data?.cancelledJobs};
  function refresh(){setPage(1);jobs.reload();summary.reload();}
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]"><WorkerSidebar/><main className="px-5 py-8 sm:px-8"><div className="mx-auto max-w-5xl"><h1 className="text-3xl font-bold">My Jobs</h1><p className="mt-2 text-slate-600">Manage active jobs and view your booking history.</p><button onClick={refresh} disabled={jobs.loading} className="mt-4 font-semibold text-teal-700 disabled:opacity-50">Refresh Jobs</button>
    <div aria-label="Filter jobs" className="mt-6 flex flex-wrap gap-3">{(Object.keys(filters) as (keyof typeof filters)[]).map(value=><button key={value} aria-pressed={tab===value} onClick={()=>{setTab(value);setPage(1);}} className={`rounded-lg border px-4 py-2 ${tab===value?"bg-teal-700 text-white":"bg-white"}`}>{value}{counts[value] !== undefined ? ` (${counts[value]})` : ""}</button>)}</div>
    {summary.error && <p role="alert" className="mt-3 text-red-700">Job counts unavailable. <button onClick={summary.reload} className="underline">Retry counts</button></p>}
    {jobs.loading ? <p role="status" className="mt-8">Loading jobs...</p> : jobs.error ? <div role="alert" className="mt-8 rounded-lg bg-red-50 p-5 text-red-800">{jobs.error}<button onClick={jobs.reload} className="ml-4 underline">Retry</button></div> : jobs.jobs.length ? <div className="mt-6 grid gap-5 md:grid-cols-2">{jobs.jobs.map(request=><JobRequestCard key={request.bookingNumber} request={request} job/>)}</div> : <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center"><p className="font-semibold">{page>1 ? "No jobs on this page." : tab==="Active"?"No active jobs.":tab==="Completed"?"No completed jobs yet.":"No cancelled jobs."}</p></div>}
    {jobs.pagination && (jobs.pagination.total>0 || page>1) && <nav aria-label="Job history pages" className="mt-6 flex flex-wrap items-center justify-center gap-4"><button disabled={jobs.loading || page===1} onClick={()=>setPage(value=>value-1)} className="rounded-lg border px-4 py-2 disabled:opacity-50">Previous</button><span>Page {page} of {Math.max(1,jobs.pagination.totalPages)}</span><button disabled={jobs.loading || page>=jobs.pagination.totalPages} onClick={()=>setPage(value=>value+1)} className="rounded-lg border px-4 py-2 disabled:opacity-50">Next</button></nav>}
    </div></main></div>;
}
