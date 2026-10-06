"use client";
import {WorkerSidebar} from "@/components/worker-sidebar";
import {JobRequestCard} from "@/components/job-request-card";
import {useJobRequests} from "@/lib/use-job-requests";
import {Suspense} from "react";
import {useSearchParams} from "next/navigation";
function JobRequestsContent() {
  const jobs = useJobRequests();
  const params = useSearchParams();
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]"><WorkerSidebar/><main className="px-5 py-8 sm:px-8"><div className="mx-auto max-w-5xl"><h1 className="text-3xl font-bold">Job Requests</h1><p className="mt-2 text-slate-600">New customer booking requests assigned to you.</p><button onClick={jobs.reload} disabled={jobs.loading} className="mt-4 font-semibold text-teal-700 disabled:opacity-50">Refresh Requests</button>
    {params.get("rejected") === "1" && <p role="status" className="mt-5 rounded-lg bg-teal-50 p-4 text-teal-800">Job request rejected.</p>}
    {jobs.loading ? <p role="status" className="mt-8">Loading job requests...</p> : jobs.error ? <div role="alert" className="mt-8 rounded-lg bg-red-50 p-5 text-red-800">{jobs.error}<button onClick={jobs.reload} className="ml-4 underline">Retry</button></div> : jobs.requests.length ? <div className="mt-6 grid gap-5 md:grid-cols-2">{jobs.requests.map(request => <JobRequestCard key={request.bookingNumber} request={request}/>)}</div> : <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center"><p className="font-semibold">No new job requests.</p><p className="mt-2 text-slate-600">New customer booking requests will appear here.</p></div>}
    </div></main></div>;
}
export default function JobRequestsPage() {return <Suspense fallback={<p className="p-8">Loading job requests...</p>}><JobRequestsContent/></Suspense>;}
