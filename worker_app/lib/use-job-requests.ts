"use client";
import {useCallback, useEffect, useState} from "react";
import {useAuth} from "@/components/auth-provider";
import {apiFetch, ApiError} from "./api";
import type {JobRequest} from "./worker-jobs";
export function useResource<T>(path: string) {
  const {user} = useAuth(); const [revision, setRevision] = useState(0);
  const key = `${user?.id || ""}:${path}:${revision}`;
  const [result, setResult] = useState<{key: string; data: T | null; error: string; status: number} | null>(null);
  useEffect(() => {let active = true;
    if (user) apiFetch<{data: T}>(path).then(response => {if (active) setResult({key, data: response.data, error: "", status: 200});}).catch(cause => {if (active) setResult({key, data: null, error: cause instanceof Error ? cause.message : "Unable to load job requests. Please try again.", status: cause instanceof ApiError ? cause.status : 0});});
    return () => {active = false;};
  }, [user, path, key]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const current = result?.key === key ? result : null;
  return {data: current?.data, error: current?.error || "", status: current?.status, loading: !current, reload};
}
export function useJobRequests() {const resource = useResource<{requests: JobRequest[]}>("/api/worker/job-requests"); return {...resource, requests: resource.data?.requests || []};}
export function useJobRequest(number: string) {const resource = useResource<{request: JobRequest}>(`/api/worker/job-requests/${encodeURIComponent(number)}`); return {...resource, request: resource.data?.request};}
export function useWorkerJob(number: string) {const resource = useResource<{booking: JobRequest}>(`/api/worker/jobs/${encodeURIComponent(number)}`); return {...resource, request: resource.data?.booking};}
export function useWorkerJobs(status = "", page = 1) {const resource = useResource<{jobs: JobRequest[]; pagination: {page:number;limit:number;total:number;totalPages:number}}>(`/api/worker/jobs?page=${page}&limit=20${status ? "&status=" + encodeURIComponent(status) : ""}`); return {...resource, jobs: resource.data?.jobs || [], pagination:resource.data?.pagination};}
export function useWorkerDashboard() {return useResource<{newRequests:number;activeJobs:number;completedJobs:number;cancelledJobs:number;todayGrossEarnings:string;timezone:string;previews:{requests:JobRequest[];active:JobRequest[]}}>("/api/worker/dashboard");}
