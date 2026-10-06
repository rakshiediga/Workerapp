"use client";

import Link from "next/link";
import { useAuth } from "../auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type FormEvent } from "react";
import { profession, type PublicWorker } from "@/lib/marketplace";
import { useMarketplace } from "@/lib/use-marketplace";
import { createBooking, formatBookingDate, localToday, timeSlots, toApiTime, validBookingDate } from "@/lib/bookings";
import { useAddresses } from "@/lib/use-addresses";

const inputClass = "mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-gray-900 focus:border-blue-600 focus:outline-2 focus:outline-blue-600";
const buttonClass = "rounded-lg bg-blue-600 px-5 py-3 text-center font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600";

function BookingForm({ worker }: { worker: PublicWorker }) {
  const router = useRouter();
  const { user } = useAuth();
  const [manualFields, setFields] = useState({ service: "", date: "", time: "", house: "", area: "", landmark: "", city: "", state: "", pincode: "", problemDescription: "" });
  const { addresses, addressesError, loading: addressesLoading, refresh: refreshAddresses } = useAddresses();
  const [addressChoice, setAddressChoice] = useState<string | null>(null);
  const chosenAddress = addressChoice === null
    ? addresses.find((address) => address.isDefault) || addresses[0]
    : addresses.find((address) => address.id === addressChoice);
  // Copy actual values into each booking, preserving its address snapshot.
  // Saved-address values are copied into the booking snapshot.
  const fields = chosenAddress ? {
    ...manualFields, house: chosenAddress.houseFlat, area: chosenAddress.streetArea,
    landmark: chosenAddress.landmark || "", city: chosenAddress.city, state: chosenAddress.state, pincode: chosenAddress.pincode,
  } : manualFields;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const selectedService = worker.services.find((service) => service.id === fields.service);
  const dateValid = validBookingDate(fields.date);
  const canConfirm = !!user && worker.isAvailable && !!selectedService && dateValid &&
    timeSlots.includes(fields.time) && !!fields.house.trim() && !!fields.area.trim() &&
    !!fields.city.trim() && !!fields.state.trim() && /^\d{6}$/.test(fields.pincode);

  function updateField(name: keyof typeof fields, value: string) {
    if (["house", "area", "landmark", "city", "state", "pincode"].includes(name)) {
      setAddressChoice("");
      setFields({ ...fields, [name]: value });
    } else {
      setFields((current) => ({ ...current, [name]: value }));
    }
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!event.currentTarget.reportValidity() || !canConfirm || !selectedService || !validBookingDate(fields.date)) {
      setError("Please complete all required fields with valid details and choose today or a future date.");
      return;
    }
    // TODO: Add server-backed idempotency for retry safety in production.
    submitting.current = true;
    setSaving(true);
    try {
      const booking = await createBooking({
        workerId: worker.id, serviceId: selectedService.id, bookingDate: fields.date, bookingTime: toApiTime(fields.time),
        address: { label: chosenAddress?.label || "Other", houseFlat: fields.house.trim(), streetArea: fields.area.trim(), landmark: fields.landmark.trim(), city: fields.city.trim(), state: fields.state.trim(), pincode: fields.pincode },
        problemDescription: fields.problemDescription.trim(),
      });
      router.push(`/booking/success?bookingId=${encodeURIComponent(booking.bookingNumber)}`);
    } catch (cause) {
      submitting.current = false;
      setSaving(false);
      setError(cause instanceof Error ? cause.message : "Unable to confirm booking. Please try again.");
    }
  }

  return (
    <>
      <section aria-label="Worker summary" className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-6">
        <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
          {worker.name.split(" ").map((name) => name[0]).join("")}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{worker.name}</h2>
          <p className="mt-1 text-gray-600">{profession(worker)}</p>
          <p className="mt-2 text-sm"><span aria-hidden="true" className="text-amber-500">★ </span>{worker.rating}<span className="sr-only"> out of 5 stars</span></p>
        </div>
        <p className="text-sm text-gray-600">Starting from <span className="font-semibold text-gray-900">₹{worker.startingPrice}</span></p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        <form id="booking-form" onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8">
          <label htmlFor="booking-service" className="block text-sm font-medium">
            Select Service
            <select id="booking-service" required value={fields.service} onChange={(event) => updateField("service", event.target.value)} className={inputClass}>
              <option value="">Choose a service</option>
              {worker.services.map((service) => <option key={service.id} value={service.id}>{service.name} - ₹{service.price}</option>)}
            </select>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label htmlFor="booking-date" className="text-sm font-medium">
              Select Date
              <input id="booking-date" type="date" required min={localToday()} value={fields.date} onChange={(event) => updateField("date", event.target.value)} className={`${inputClass} min-w-0`} />
            </label>
            <label htmlFor="booking-time" className="text-sm font-medium">
              Select Time
              <select id="booking-time" required value={fields.time} onChange={(event) => updateField("time", event.target.value)} className={inputClass}>
                <option value="">Choose a time</option>
                {timeSlots.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="text-lg font-semibold">Customer Address</legend>
            {addressesLoading && <p role="status" className="mt-4 text-sm">Loading addresses...</p>}
            {addressesError && <div role="status" className="mt-4 text-sm text-amber-800"><p>Saved addresses could not be loaded. You can enter an address manually. {addressesError}</p><button type="button" onClick={refreshAddresses} className="mt-2 text-blue-600">Retry</button></div>}
            {addresses.length > 0 && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <label htmlFor="booking-saved-address" className="block text-sm font-medium">Choose Saved Address
                <select id="booking-saved-address" value={chosenAddress?.id || ""} onChange={(event) => { setAddressChoice(event.target.value); setError(""); }} className={inputClass}>
                  {addresses.map((address) => <option key={address.id} value={address.id}>{address.label}{address.isDefault ? " (Default)" : ""} — {address.houseFlat}, {address.streetArea}, {address.city}, {address.pincode}</option>)}
                  <option value="">Use a Different Address</option>
                </select>
              </label>
              <button type="button" onClick={() => { setAddressChoice(""); setError(""); }} className="mt-3 rounded text-sm font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-600">Use a Different Address</button>
            </div>}
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <label htmlFor="booking-house" className="text-sm font-medium">House / Flat Number
                <input id="booking-house" autoComplete="address-line1" required maxLength={100} value={fields.house} onChange={(event) => updateField("house", event.target.value)} className={inputClass} />
              </label>
              <label htmlFor="booking-area" className="text-sm font-medium">Street / Area
                <input id="booking-area" autoComplete="address-line2" required maxLength={150} value={fields.area} onChange={(event) => updateField("area", event.target.value)} className={inputClass} />
              </label>
              <label htmlFor="booking-landmark" className="text-sm font-medium sm:col-span-2">Landmark (optional)
                <input id="booking-landmark" maxLength={150} value={fields.landmark} onChange={(event) => updateField("landmark", event.target.value)} className={inputClass} />
              </label>
              <label htmlFor="booking-city" className="text-sm font-medium">City
                <input id="booking-city" autoComplete="address-level2" required maxLength={100} value={fields.city} onChange={(event) => updateField("city", event.target.value)} className={inputClass} />
              </label>
              <label htmlFor="booking-state" className="text-sm font-medium">State
                <input id="booking-state" autoComplete="address-level1" required maxLength={100} value={fields.state} onChange={(event) => updateField("state", event.target.value)} className={inputClass} />
              </label>
              <label htmlFor="booking-pincode" className="text-sm font-medium">Pincode
                <input id="booking-pincode" autoComplete="postal-code" inputMode="numeric" required pattern="[0-9]{6}" maxLength={6} title="Enter a 6-digit pincode" value={fields.pincode} onChange={(event) => updateField("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))} className={inputClass} />
              </label>
            </div>
          </fieldset>

          <label htmlFor="booking-problem" className="block text-sm font-medium">Describe the problem
            <textarea id="booking-problem" rows={4} maxLength={1000} value={fields.problemDescription} onChange={(event) => updateField("problemDescription", event.target.value)} placeholder="Example: Kitchen tap is leaking continuously..." className={`${inputClass} resize-y`} />
            <span className="mt-1 block text-xs text-gray-500">Optional · {fields.problemDescription.length}/1000 characters</span>
          </label>

          <label htmlFor="booking-mobile" className="block text-sm font-medium">Mobile Number
            <div className="mt-2 flex rounded-lg border border-gray-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600">
              <span className="flex items-center border-r border-gray-300 px-4 text-gray-600">+91</span>
              <input id="booking-mobile" type="tel" autoComplete="tel-national" inputMode="numeric" required pattern="[0-9]{10}" maxLength={10} title="Enter a 10-digit mobile number" placeholder="10-digit mobile number" value={user?.phone || ""} readOnly className="min-w-0 flex-1 rounded-r-lg px-3 py-3 outline-none" />
            </div>
          </label>
        </form>

        <aside aria-labelledby="summary-heading" className="rounded-2xl border border-gray-200 bg-white p-6 lg:sticky lg:top-6">
          <h2 id="summary-heading" className="text-xl font-semibold">Booking Summary</h2>
          <dl className="mt-5 space-y-4 text-sm">
            {[
              ["Worker", worker.name], ["Service", selectedService?.name || "Select a service"],
              ["Date", dateValid ? formatBookingDate(fields.date) : "Select a date"], ["Time", fields.time || "Select a time"],
              ["Service Price", selectedService ? `₹${selectedService.price}` : "—"],
            ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-gray-500">{label}</dt><dd className="break-words text-right font-medium">{value}</dd></div>)}
            <div className="flex justify-between gap-4 border-t border-gray-200 pt-4 text-lg font-bold"><dt>Total</dt><dd>{selectedService ? `₹${selectedService.price}` : "—"}</dd></div>
          </dl>
          <p className="mt-5 text-xs leading-5 text-gray-500">Final price is verified by the server when you confirm. Payment is not collected here.</p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button form="booking-form" type="submit" disabled={!canConfirm || saving} className={`${buttonClass} mt-5 w-full disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500`}>
            {saving ? "Confirming Booking..." : "Confirm Booking"}
          </button>
          {!canConfirm && <p className="mt-2 text-xs text-gray-500">Complete all required fields to confirm your booking.</p>}
        </aside>
      </div>
    </>
  );
}

function BookingContent() {
  const searchParams = useSearchParams();
  const workerId = searchParams.get("workerId");
  const { data, loading, error, status, retry } = useMarketplace<{ worker: PublicWorker }>(workerId ? `/api/workers/${encodeURIComponent(workerId)}` : null);
  const worker = data?.worker;
  if (loading) return <p role="status">Loading worker profile...</p>;
  if (error && status !== 404) return <section role="alert" className="rounded-2xl border bg-white p-8"><h1 className="text-2xl font-bold">Unable to load worker</h1><p className="mt-3">{error}</p><button onClick={retry} className="mt-4 text-blue-600">Retry</button></section>;

  if (!worker) return (
    <section className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <h1 className="text-3xl font-bold">Worker not found</h1>
      <Link href="/workers" className={`${buttonClass} mt-6 inline-block`}>Back to Workers</Link>
    </section>
  );

  return (
    <>
      <Link href={`/workers/${worker.id}`} className="mb-6 inline-block rounded text-sm font-medium text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">← Back to Worker Profile</Link>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Book a Service</h1>
      {worker.isAvailable ? <BookingForm key={worker.id} worker={worker} /> : (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-8">
          <h2 className="text-xl font-semibold">{worker.name}</h2>
          <p role="status" className="mt-3 text-red-700">This worker is currently unavailable.</p>
          <button type="button" disabled className="mt-5 cursor-not-allowed rounded-lg bg-gray-200 px-5 py-3 font-semibold text-gray-500">Confirm Booking</button>
          <Link href="/workers" className={`${buttonClass} mt-4 block sm:ml-4 sm:inline-block`}>Find Other Workers</Link>
        </section>
      )}
    </>
  );
}

export default function BookingPage() {
  return <Suspense fallback={<p role="status">Loading booking form...</p>}><BookingContent /></Suspense>;
}
