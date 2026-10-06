"use client";
import { useApi } from "./use-api";
export function useMarketplace<T>(path: string | null) { return useApi<T>(path, false); }
