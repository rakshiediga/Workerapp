"use client";
import { CustomerNav } from "@/app/customer-nav";
import Link from "next/link";


import { useAuth } from "../auth-provider";
import { AuthGuard } from "../auth-guard";
import { useRef, useState, type FormEvent } from "react";
import { addressLabels, addressValidation, deleteAddress, saveAddress, setDefaultAddress, type AddressInput, type SavedAddress } from "@/lib/addresses";
import { useAddresses } from "@/lib/use-addresses";

const inputClass = "mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-gray-900 focus:border-blue-600 focus:outline-2 focus:outline-blue-600";
const buttonClass = "rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600";
const secondaryClass = "rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600";

function ProfileInformation() {
  const { user, loading, saveProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (name.trim().length < 2 || name.trim().length > 100) { setError("Name must contain between 2 and 100 characters."); return; }
    if (email.trim() && (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) { setError("Enter a valid email address."); return; }
    submitting.current = true; setSaving(true); setError(""); setSuccess("");
    try { await saveProfile({ name: name.trim(), email: email.trim() }); setEditing(false); setSuccess("Profile updated successfully"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update profile. Please try again."); }
    finally { submitting.current = false; setSaving(false); }
  }
  if (loading) return <p role="status">Loading profile...</p>;
  return <>
    <div aria-hidden="true" className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">{(user?.name || "").split(" ").filter(Boolean).map(name => name[0]).slice(0, 2).join("")}</div>
    <h2 id="profile-heading" className="text-xl font-semibold">Profile Information</h2>
    {editing ? <form onSubmit={submit} noValidate className="mt-5 space-y-5">
      <label htmlFor="profile-name" className="block text-sm font-medium">Full Name<input id="profile-name" autoComplete="name" maxLength={100} required value={name} disabled={saving} onChange={event => setName(event.target.value)} className={inputClass} /></label>
      <label htmlFor="profile-phone" className="block text-sm font-medium">Mobile Number<input id="profile-phone" readOnly value={`+91 ${user?.phone || ""}`} className={inputClass} /></label>
      <label htmlFor="profile-email" className="block text-sm font-medium">Email (optional)<input id="profile-email" type="email" autoComplete="email" maxLength={254} value={email} disabled={saving} onChange={event => setEmail(event.target.value)} className={inputClass} /></label>
      <div className="flex flex-wrap gap-3"><button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save Changes"}</button><button type="button" disabled={saving} onClick={() => { setEditing(false); setError(""); }} className={secondaryClass}>Cancel</button></div>
    </form> : <>
      <dl className="mt-5 space-y-5 text-sm">{[["Full Name", user?.name], ["Mobile Number", `+91 ${user?.phone || ""}`], ["Email", user?.email || "Not provided"]].map(([label, value]) => <div key={label}><dt className="text-gray-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
      <button onClick={() => { setName(user?.name || ""); setEmail(user?.email || ""); setError(""); setSuccess(""); setEditing(true); }} className={`${secondaryClass} mt-5`}>Edit Profile</button>
    </>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="mt-4 text-sm text-green-700">{success}</p>}
  </>;
}

function AddressForm({ address, onDone }: { address: SavedAddress | null; onDone: () => void }) {
  const [fields, setFields] = useState<AddressInput>(address ? { label: address.label, houseFlat: address.houseFlat, streetArea: address.streetArea, landmark: address.landmark || "", city: address.city, state: address.state, pincode: address.pincode } : { label: "Home", houseFlat: "", streetArea: "", landmark: "", city: "", state: "", pincode: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const validation = addressValidation(fields);
    if (validation) { setError(validation); return; }
    submitting.current = true; setSaving(true); setError("");
    try { await saveAddress(fields, address?.id); onDone(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save address. Please try again."); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <form onSubmit={submit} noValidate className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
    <h3 className="text-lg font-semibold">{address ? "Edit Address" : "Add New Address"}</h3>
    <label htmlFor="address-label" className="mt-4 block text-sm font-medium">Address Label<select id="address-label" value={fields.label} onChange={(event) => setFields({ ...fields, label: event.target.value as SavedAddress["label"] })} className={inputClass}>{addressLabels.map((label) => <option key={label}>{label}</option>)}</select></label>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      {([['houseFlat', 'House / Flat Number'], ['streetArea', 'Street / Area'], ['landmark', 'Landmark (optional)'], ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode']] as const).map(([key, label]) => <label key={key} htmlFor={`address-${key}`} className="text-sm font-medium">{label}<input id={`address-${key}`} required={key !== "landmark"} inputMode={key === "pincode" ? "numeric" : "text"} maxLength={key === "pincode" ? 6 : ["houseFlat", "city", "state"].includes(key) ? 100 : 150} value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: key === "pincode" ? event.target.value.replace(/\D/g, "").slice(0, 6) : event.target.value })} className={inputClass} /></label>)}
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-3"><button type="submit" disabled={saving} className={buttonClass}>{saving ? address ? "Updating..." : "Saving..." : "Save Address"}</button><button type="button" disabled={saving} onClick={onDone} className={secondaryClass}>Cancel</button></div>
  </form>;
}

export default function CustomerProfilePage() {
  const { addresses, addressesError, loading, refresh } = useAddresses();

  const [addressForm, setAddressForm] = useState<SavedAddress | "new" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const acting = useRef(false);
  async function addressAction(action: () => Promise<unknown>, message: string) {
    if (acting.current) return;
    acting.current = true; setBusy(message); setActionError("");
    try { await action(); setDeleting(null); setAddressForm(null); refresh(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to update address. Please try again."); }
    finally { acting.current = false; setBusy(null); }
  }
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600";

  return <AuthGuard><div className="min-h-screen bg-gray-50 text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Link href="/" className={`rounded text-2xl font-bold text-blue-600 ${focus}`}>WorkerBooking</Link>
      <CustomerNav />
    </div></header>
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">Customer Profile</h1><p className="mt-3 text-gray-600">Manage your profile and saved addresses.</p>
      {loading ? <p role="status" className="mt-8">Loading addresses...</p> : <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr] lg:items-start">
        <section aria-labelledby="profile-heading" className="min-w-0 rounded-2xl border border-gray-200 bg-white p-6">
          <ProfileInformation />
        </section>
        <section aria-labelledby="addresses-heading" className="min-w-0 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="addresses-heading" className="text-xl font-semibold">Saved Addresses</h2>{!addressesError && <button type="button" onClick={() => { setAddressForm("new"); setDeleting(null); setActionError(""); }} className={buttonClass}>+ Add New Address</button>}</div>
          {addressesError ? <p role="alert" className="mt-4 text-sm text-red-700">{addressesError}<button onClick={refresh} className="ml-3 text-blue-600">Retry</button></p> : <>
            {addressForm && <AddressForm key={addressForm === "new" ? "new" : addressForm.id} address={addressForm === "new" ? null : addressForm} onDone={() => { setAddressForm(null); refresh(); }} />}
            {addresses.length === 0 ? <div className="py-10 text-center"><p className="font-medium">No saved addresses yet.</p><p className="mt-2 text-sm text-gray-500">Add an address to make future bookings faster.</p></div> : <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {addresses.map((address) => <article key={address.id} className="min-w-0 rounded-xl border border-gray-200 p-5">
                <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">{address.label}</h3>{address.isDefault && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">Default</span>}</div>
                <p className="mt-3 break-words text-sm leading-6 text-gray-600">{address.houseFlat}<br />{address.streetArea}<br />{address.landmark && <>{address.landmark}<br /></>}{address.city}<br />{address.state}<br />{address.pincode}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm"><button type="button" onClick={() => { setAddressForm(address); setDeleting(null); }} className={secondaryClass}>Edit</button><button type="button" onClick={() => setDeleting(address.id)} className={`${secondaryClass} text-red-700`}>Delete</button>{!address.isDefault && <button type="button" disabled={!!busy} onClick={() => addressAction(() => setDefaultAddress(address.id), "Updating...")} className={`${secondaryClass} text-blue-700`}>Set as Default</button>}</div>
                {deleting === address.id && <div role="group" aria-label="Confirm address deletion" className="mt-4 rounded-lg bg-red-50 p-3"><p className="text-sm">Are you sure you want to delete this address?</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={!!busy} onClick={() => addressAction(() => deleteAddress(address.id), "Deleting...")} className="rounded px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Yes, Delete</button><button type="button" onClick={() => setDeleting(null)} className="rounded px-3 py-2 text-sm font-medium hover:bg-gray-100">Cancel</button></div></div>}
              </article>)}
            </div>}
          </>}
          {busy && <p role="status" className="mt-4">{busy}</p>}
          {actionError && <p role="alert" className="mt-4 text-sm text-red-700">{actionError}</p>}
        </section>
      </div>}
    </main>
  </div></AuthGuard>;
}
