import { apiFetch } from "./api";

export const bookingStatuses = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type BookingStatus = typeof bookingStatuses[number];
export const statusLabels: Record<BookingStatus, string> = {
  REQUESTED: "Requested", ACCEPTED: "Accepted", IN_PROGRESS: "In Progress",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
};
export interface BookingAddress {
  label?: string; houseFlat: string; streetArea: string; landmark?: string | null;
  city: string; state: string; pincode: string;
}
export interface Booking {
  bookingNumber: string; status: BookingStatus;
  worker: { id: string; name: string };
  service: { id: string; name: string; category: { id: string; name: string; slug: string } };
  bookingDate: string; bookingTime: string; price: string;
  address: BookingAddress; customerPhone: string; problemDescription: string | null; createdAt: string;
  statusHistory: { status: BookingStatus; createdAt: string; reason?: string | null; actor?: string | null }[];
}
export interface CreateBookingInput {
  workerId: string; serviceId: string; bookingDate: string; bookingTime: string;
  address: BookingAddress; problemDescription?: string;
}
export async function createBooking(input: CreateBookingInput) {
  const response = await apiFetch<{ success: true; data: { booking: Booking } }>("/api/bookings", { method: "POST", body: JSON.stringify(input) });
  if (!response.success || !response.data?.booking?.bookingNumber) throw new Error("The server returned an unexpected booking response. Check My Bookings before trying again.");
  return response.data.booking;
}
export async function cancelBooking(number: string) {
  return apiFetch<{ success: true; data: { booking: Booking } }>(`/api/bookings/${encodeURIComponent(number)}/cancel`, { method: "PATCH" });
}
export const timeSlots = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM"];
const apiSlots = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
export function toApiTime(value: string) { return apiSlots[timeSlots.indexOf(value)] || ""; }
export function formatBookingTime(value: string) { return timeSlots[apiSlots.indexOf(value)] || value; }
export function localToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validBookingDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= localToday();
}
export function formatBookingDate(value: string) {
  return new Date(value + "T12:00:00Z").toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });
}
