"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { cancelBooking, formatBookingDate, formatBookingTime, statusLabels, type Booking, type BookingStatus } from "@/lib/bookings";
import { useApi } from "@/lib/use-api";
import { StatusBadge } from "../booking-status";

function Details({ booking, onCancelled }: { booking: Booking; onCancelled: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const stages: BookingStatus[] = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"];
  const activeStage = stages.indexOf(booking.status);
  const created = Date.parse(booking.createdAt);
  const sections = [
    { title: "Worker Information", rows: [["Worker name", booking.worker.name], ["Profession", booking.service.category.name]] },
    { title: "Service Information", rows: [["Service", booking.service.name], ["Price", `₹${booking.price}`]] },
    { title: "Schedule", rows: [["Date", formatBookingDate(booking.bookingDate)], ["Time", formatBookingTime(booking.bookingTime)]] },
    { title: "Service Address", rows: [["Address", [booking.address.houseFlat, booking.address.streetArea, booking.address.landmark, booking.address.city, booking.address.state, booking.address.pincode].filter(Boolean).join(", ")]] },
    { title: "Customer Contact", rows: [["Mobile number", `+91 ${booking.customerPhone}`]] },
    { title: "Booking Created", rows: [["Created", Number.isNaN(created) ? "Not recorded" : new Date(created).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })]] },
  ];

  async function confirmCancel() {
    if (submitting.current) return;
    submitting.current = true; setCancelling(true); setError("");
    try { await cancelBooking(booking.bookingNumber); setConfirming(false); onCancelled(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to cancel booking. Please try again."); }
    finally { submitting.current = false; setCancelling(false); }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold sm:text-4xl">Booking Details</h1><p className="mt-3 break-all text-gray-600">Booking #{booking.bookingNumber}</p></div>
        <StatusBadge status={booking.status} />
      </div>
      <section aria-labelledby="status-heading" className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 id="status-heading" className="text-xl font-semibold">Booking Status</h2>
        {booking.status === "CANCELLED" ? <p role="status" className="mt-4 font-semibold text-red-700">Booking Cancelled</p> : (
          <ol className="mt-5 grid gap-3 sm:grid-cols-4">
            {stages.map((stage, index) => (
              <li key={stage} aria-current={index === activeStage ? "step" : undefined} className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${index === activeStage ? "border-blue-600 bg-blue-50 font-semibold text-blue-800" : index < activeStage ? "border-green-200 bg-green-50 text-green-800" : "border-gray-200 text-gray-500"}`}>
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">{index < activeStage ? "✓" : index + 1}</span>{statusLabels[stage]}
              </li>
            ))}
          </ol>
        )}
        <ol aria-label="Status history" className="mt-5 space-y-2 text-sm text-gray-600">{booking.statusHistory.map((entry, index) => <li key={index}>{entry.status === "CANCELLED" && entry.actor === "WORKER" ? "Worker declined this request." : statusLabels[entry.status]} <span className="text-gray-500">{new Date(entry.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>{entry.reason && <p className="mt-1 whitespace-pre-wrap break-words">{entry.reason}</p>}</li>)}</ol>
      </section>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <dl className="mt-4 space-y-3 text-sm">{section.rows.map(([label, value]) => <div key={label}><dt className="text-gray-500">{label}</dt><dd className="mt-1 break-words leading-6">{value}</dd></div>)}</dl>
          </section>
        ))}
        {booking.problemDescription && <section className="rounded-2xl border border-gray-200 bg-white p-6 md:col-span-2"><h2 className="text-lg font-semibold">Problem Description</h2><p className="mt-4 whitespace-pre-wrap break-words leading-7 text-gray-600">{booking.problemDescription}</p></section>}
      </div>

      {booking.status === "REQUESTED" && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          {confirming ? (
            <div role="group" aria-label="Confirm cancellation">
              <p className="font-medium">Are you sure you want to cancel this booking?</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" disabled={cancelling} onClick={confirmCancel} className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600">{cancelling ? "Cancelling Booking..." : "Yes, Cancel Booking"}</button>
                <button type="button" disabled={cancelling} onClick={() => { setConfirming(false); setError(""); }} className="rounded-lg border border-gray-300 px-5 py-3 font-semibold hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600">Keep Booking</button>
              </div>
            </div>
          ) : <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-red-300 px-5 py-3 font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600">Cancel Booking</button>}
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        </section>
      )}
      {(booking.status === "COMPLETED" || booking.status === "CANCELLED") && <Link href={{ pathname: "/booking", query: { workerId: booking.worker.id } }} className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Book Again</Link>}
    </>
  );
}

export default function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, status, retry } = useApi<{ booking: Booking }>(`/api/bookings/${encodeURIComponent(id)}`);
  const booking = data?.booking;
  return (
    <>
      <Link href="/bookings" className="mb-6 inline-block rounded text-sm font-medium text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">← Back to My Bookings</Link>
      {loading ? <p role="status">Loading booking details...</p> : error && status !== 404 ? <section role="alert" className="rounded-2xl border bg-white p-8"><h1 className="text-2xl font-bold">Unable to load booking</h1><p className="mt-3">{error}</p><button onClick={retry} className="mt-4 text-blue-600">Retry</button></section> : !booking ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-3xl font-bold">Booking not found</h1>
          <p className="mt-3 text-gray-600">{error || "Please check the booking number."}</p>
          <Link href="/bookings" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">Back to My Bookings</Link>
        </section>
      ) : <Details key={booking.bookingNumber} booking={booking} onCancelled={retry} />}
    </>
  );
}
