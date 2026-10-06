"use client";
import { useAuth } from "@/app/auth-provider";
import { useApi } from "./use-api";
import type { SavedAddress } from "./addresses";
export function useAddresses() {
 const { user, loading: authLoading } = useAuth();
 const { data, loading, error, retry } = useApi<{ addresses: SavedAddress[] }>(user ? "/api/addresses" : null, true, user?.id || "");
 return { addresses: data?.addresses || [], addressesError: error, loading: authLoading || loading, refresh: retry };
}
