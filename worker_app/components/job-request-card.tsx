import Link from "next/link";
import {jobDate,jobTimestamp,jobMoney,cancellation,type JobRequest} from "@/lib/worker-jobs";
const labels={REQUESTED:"New Request",ACCEPTED:"Accepted",IN_PROGRESS:"In Progress",COMPLETED:"Completed",CANCELLED:"Cancelled"};
export function JobRequestCard({request,job=false,linkLabel}: {request:JobRequest;job?:boolean;linkLabel?:string}) {
  const completed=request.statusHistory.slice().reverse().find(entry=>entry.status==="COMPLETED");
  const cancelled=cancellation(request);
  return <article className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-lg font-semibold">{request.service.name}</h3><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{labels[request.status]}</span></div>
    <p className="mt-2 break-all text-xs text-slate-500">{request.bookingNumber}</p><p className="mt-3">{request.customer.name}</p>
    <p className="mt-2 text-sm text-slate-600">{request.status==="COMPLETED" && completed ? `Completed: ${jobTimestamp(completed.createdAt)}` : `${jobDate(request.bookingDate)} - ${request.bookingTime}`}</p><p className="mt-2 text-sm text-slate-600">{request.address.streetArea}, {request.address.city}</p><p className="mt-3 font-semibold">{jobMoney(request.price)}</p>
    {request.status==="CANCELLED" && <div className="mt-3 text-sm"><p>{cancelled.label}</p>{cancelled.reason && <p className="mt-1 whitespace-pre-wrap break-words">Reason: {cancelled.reason}</p>}</div>}
    {request.problemDescription && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{request.problemDescription}</p>}
    <Link href={`/${job?"jobs":"job-requests"}/${encodeURIComponent(request.bookingNumber)}`} className="mt-4 inline-block font-semibold text-teal-700">{linkLabel || (job && ["ACCEPTED","IN_PROGRESS"].includes(request.status)?"View Job":"View Details")}</Link>
  </article>;
}
