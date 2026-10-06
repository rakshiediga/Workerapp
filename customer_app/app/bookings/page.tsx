"use client";

import Link from "next/link";
import { useState } from "react";
import { bookingStatuses, formatBookingDate, formatBookingTime, statusLabels, type Booking, type BookingStatus } from "@/lib/bookings";
import { useApi } from "@/lib/use-api";
import { StatusBadge } from "./booking-status";

export default function MyBookingsPage() {
  const { data, error, loading, retry } = useApi<{ bookings: Booking[] }>("/api/bookings/my");
  const bookings = data?.bookings || [];
  const [filter, setFilter] = useState<BookingStatus | "All">("All");
  const filtered = bookings.filter((booking) => filter === "All" || booking.status === filter)
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My Bookings</h1>
      <p className="mt-3 text-gray-600">View and manage your service bookings.</p>
      <div aria-label="Filter bookings by status" className="mt-8 flex flex-wrap gap-2">
        {(["All", ...bookingStatuses] as const).map((status) => (
          <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)} className={`rounded-lg border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${filter === status ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-blue-400"}`}>
            {status === "All" ? "All" : statusLabels[status]}
          </button>
        ))}
      </div>

      {loading ? <p role="status" className="mt-8">Loading bookings...</p> : error ? (
        <div role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700"><p>{error}</p><button onClick={retry} className="mt-4 text-blue-600">Retry</button></div>
      ) : bookings.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center sm:py-16">
          <h2 className="text-2xl font-semibold">No bookings yet</h2>
          <p className="mt-3 text-gray-600">You haven&apos;t booked any services yet.</p>
          <Link href="/services" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Find a Service</Link>
        </section>
      ) : (
        <section aria-label="Bookings" className="mt-8">
          <p role="status" className="mb-4 text-sm text-gray-600">{filtered.length} {filtered.length === 1 ? "booking" : "bookings"} found</p>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((booking) => (
              <article key={booking.bookingNumber} className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="break-all text-sm font-semibold text-gray-600">Booking #{booking.bookingNumber}</p>
                  <StatusBadge status={booking.status} />
                </div>
                <h2 className="mt-5 break-words text-xl font-semibold">{booking.worker.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{booking.service.category.name}</p>
                <p className="mt-4 font-medium">{booking.service.name}</p>
                <dl className="mt-4 space-y-3 text-sm">
                  {[["Date", formatBookingDate(booking.bookingDate)], ["Time", formatBookingTime(booking.bookingTime)], ["Location", `${booking.address.streetArea}, ${booking.address.city}`]].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4"><dt className="text-gray-500">{label}</dt><dd className="break-words sm:text-right">{value}</dd></div>
                  ))}
                </dl>
                <p className="mt-5 text-xl font-bold">₹{booking.price}</p>
                <Link href={`/bookings/${encodeURIComponent(booking.bookingNumber)}`} className="mt-6 block rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">View Details</Link>
              </article>
            ))}
          </div>
          {filtered.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-600">No bookings found for this status.</p>}
        </section>
      )}
    </>
  );
}
