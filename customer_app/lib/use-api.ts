"use client";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "./api";
interface ApiResponse<T> { success: true; data: T }
export function useApi<T>(path: string | null, authenticated = true, scope = "") {
 const [revision, setRevision] = useState(0);
 const [state, setState] = useState<{ key: string; data: T | null; error: string; status: number }>({ key: "", data: null, error: "", status: 0 });
 const key = `${path}:${revision}:${authenticated}:${scope}`;
 useEffect(() => {
  if (!path) return;
  let active = true;
  const controller = new AbortController();
  void apiFetch<ApiResponse<T>>(path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }, authenticated).then(response => {
   if (!response.success || !response.data) throw new Error("The server returned an unexpected response. Please try again.");
   if (active) setState({ key, data: response.data, error: "", status: 200 });
  }).catch(cause => { if (active) setState({ key, data: null, error: cause instanceof Error ? cause.message : "Unable to load data. Please try again.", status: cause instanceof ApiError ? cause.status : 0 }); });
  return () => { active = false; controller.abort(); };
 }, [path, key, authenticated]);
 return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : "", status: state.key === key ? state.status : 0, loading: !!path && state.key !== key, retry: () => setRevision(value => value + 1) };
}
