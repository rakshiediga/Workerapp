"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { formatBookingDate, formatBookingTime, statusLabels, type Booking } from "@/lib/bookings";
import { useApi } from "@/lib/use-api";

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const { data, error, loading, status, retry } = useApi<{ booking: Booking }>(bookingId ? `/api/bookings/${encodeURIComponent(bookingId)}` : null);
  const booking = data?.booking;

  if (loading) return <p role="status">Loading booking details...</p>;
  if (error && status !== 404) return <section role="alert" className="rounded-2xl border bg-white p-8"><h1 className="text-2xl font-bold">Unable to load booking</h1><p className="mt-3">{error}</p><button onClick={retry} className="mt-4 text-blue-600">Retry</button></section>;
  if (!booking) return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <h1 className="text-3xl font-bold">Booking not found</h1>
      <p className="mt-3 text-gray-600">{error || "Please check your booking ID."}</p>
      <Link href="/workers" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">Back to Workers</Link>
    </section>
  );

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
      <div className="text-center">
        <div aria-hidden="true" className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">✓</div>
        <h1 className="text-3xl font-bold">Booking Request Sent</h1>
        <p className="mt-3 text-gray-600">Your booking request has been recorded.</p>
      </div>
      <dl className="mt-8 divide-y divide-gray-100">
        {[
          ["Booking ID", booking.bookingNumber], ["Worker", booking.worker.name], ["Service", booking.service.name],
          ["Date", formatBookingDate(booking.bookingDate)], ["Time", formatBookingTime(booking.bookingTime)], ["Price", `₹${booking.price}`],
          ["Status", statusLabels[booking.status]],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-4 text-sm"><dt className="text-gray-500">{label}</dt><dd className={`break-all text-right font-semibold ${label === "Status" ? "text-blue-700" : ""}`}>{value}</dd></div>
        ))}
      </dl>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/bookings" className="rounded-lg bg-blue-600 px-5 py-3 text-center font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">View My Bookings</Link>
        <Link href="/" className="rounded-lg border border-gray-300 px-5 py-3 text-center font-semibold hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Back to Home</Link>
      </div>
    </section>
  );
}

export default function BookingSuccessPage() {
  return <Suspense fallback={<p role="status">Loading booking details...</p>}><SuccessContent /></Suspense>;
}
