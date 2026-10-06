import { apiFetch } from "./api";
export const addressLabels = ["Home", "Work", "Other"] as const;
export interface AddressInput { label: string; houseFlat: string; streetArea: string; landmark: string; city: string; state: string; pincode: string }
export interface SavedAddress extends Omit<AddressInput, "landmark"> { id: string; landmark: string | null; latitude: string | null; longitude: string | null; isDefault: boolean }
export function addressValidation(address: AddressInput) {
 for (const [key,label] of [["label","Address Label"],["houseFlat","House / Flat Number"],["streetArea","Street / Area"],["city","City"],["state","State"]] as const) if (!address[key].trim()) return label + " is required.";
 if (!/^\d{6}$/.test(address.pincode)) return "Pincode must contain exactly 6 digits.";
 return "";
}
export function saveAddress(input: AddressInput, id?: string) {
 return apiFetch<{ success: true; data: { address: SavedAddress } }>(id ? `/api/addresses/${encodeURIComponent(id)}` : "/api/addresses", { method: id ? "PATCH" : "POST", body: JSON.stringify(input) });
}
export function deleteAddress(id: string) { return apiFetch<{ success: true }>(`/api/addresses/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function setDefaultAddress(id: string) { return apiFetch<{ success: true; data: { address: SavedAddress } }>(`/api/addresses/${encodeURIComponent(id)}/default`, { method: "PATCH" }); }
