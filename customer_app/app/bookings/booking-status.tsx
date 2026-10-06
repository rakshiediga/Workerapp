import { statusLabels, type BookingStatus } from "@/lib/bookings";

const colors: Record<BookingStatus, string> = {
  REQUESTED: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-purple-100 text-purple-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${colors[status]}`}>{statusLabels[status]}</span>;
}
