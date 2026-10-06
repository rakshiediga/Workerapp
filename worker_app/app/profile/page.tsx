"use client";
import {useRef, useState, type FormEvent} from "react";
import {useAuth} from "@/components/auth-provider";
import {WorkerSidebar} from "@/components/worker-sidebar";
import {profileCompletion, verificationLabels, type ProfileInput} from "@/lib/auth";
const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 focus:outline-teal-700";
export default function ProfilePage() {
  const {user, workerProfile: profile, saveProfile, logout} = useAuth();
  const [fields, setFields] = useState<ProfileInput | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const submitting = useRef(false);
  const completion = profileCompletion(user, profile);
  if (!user || !profile) return <p role="status" className="p-8">Loading worker profile...</p>;
  function edit() { if (!user || !profile) return; setFields({name:user.name,email:user.email||"",bio:profile.bio||"",experienceYears:profile.experienceYears,city:profile.city||"",serviceArea:profile.serviceArea||"",startingPrice:profile.startingPrice}); setError(""); setMessage(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!fields || submitting.current) return; setError(""); setMessage("");
    if (!fields.name.trim() || !fields.city.trim()) {setError("Full Name and City are required.");return;}
    if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {setError("Enter a valid email address.");return;}
    if (!Number.isInteger(fields.experienceYears) || fields.experienceYears < 0 || fields.experienceYears > 60) {setError("Experience must be an integer between 0 and 60.");return;}
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(fields.startingPrice.trim())) {setError("Starting price must be a non-negative amount with at most two decimal places.");return;}
    submitting.current=true;setSaving(true);
    try {await saveProfile(fields);setFields(null);setMessage("Profile updated successfully");}
    catch(cause){setError(cause instanceof Error?cause.message:"Unable to save profile. Please try again.");}
    finally{submitting.current=false;setSaving(false);}
  }
  const value = (label: string, text: string | number | null | undefined) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-2 whitespace-pre-wrap break-words font-medium">{text ?? "Not provided"}</dd></div>;
  const field = (key: "name"|"email"|"city"|"serviceArea"|"startingPrice", label: string, maxLength=100) => fields && <label htmlFor={`profile-${key}`} className="block text-sm font-medium">{label}<input id={`profile-${key}`} type={key==="email"?"email":"text"} inputMode={key==="startingPrice"?"decimal":"text"} maxLength={maxLength} value={fields[key]} onChange={event=>setFields({...fields,[key]:event.target.value})} className={inputClass}/></label>;
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]"><WorkerSidebar/><main className="min-w-0 px-5 py-8 sm:px-8"><div className="mx-auto max-w-5xl">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold">Worker Profile</h1><button onClick={logout} className="font-semibold text-teal-700">Logout</button></div><p className="mt-3 text-slate-600">Tell customers about your skills and service area.</p><p className="mt-4 text-sm text-teal-700">Basic & professional profile: {completion.percentage}% complete</p>
    {fields ? <form onSubmit={submit} noValidate className="mt-7 rounded-xl border border-slate-200 bg-white p-6"><fieldset disabled={saving} className="grid gap-5 sm:grid-cols-2"><legend className="mb-5 text-xl font-semibold">Edit Profile</legend>
      {field("name","Full Name")}{field("email","Email (optional)",254)}
      <label className="text-sm font-medium">Mobile Number<input readOnly value={`+91 ${user.phone}`} className={inputClass}/></label><label className="text-sm font-medium">Profession<input readOnly value={profile.primaryCategory?.name||"Not specified"} className={inputClass}/></label>
      <label htmlFor="profile-bio" className="block text-sm font-medium sm:col-span-2">Bio<textarea id="profile-bio" maxLength={1000} rows={5} value={fields.bio} onChange={event=>setFields({...fields,bio:event.target.value})} className={inputClass}/><span className="mt-2 block text-xs text-slate-500">{fields.bio.length} / 1000</span></label>
      <label htmlFor="profile-experience" className="block text-sm font-medium">Experience (years)<input id="profile-experience" type="number" min={0} max={60} step={1} value={Number.isNaN(fields.experienceYears)?"":fields.experienceYears} onChange={event=>setFields({...fields,experienceYears:event.target.value===""?NaN:Number(event.target.value)})} className={inputClass}/></label>
      {field("city","City")}{field("serviceArea","Service Area (optional)",200)}{field("startingPrice","Starting Price",13)}
      <p className="text-sm text-slate-500 sm:col-span-2">Customers see starting prices from My Services. This profile estimate does not set booking prices.</p>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button disabled={saving} className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white">{saving?"Saving...":"Save Changes"}</button><button type="button" disabled={saving} onClick={()=>{setFields(null);setError("");}} className="rounded-lg border border-slate-300 px-5 py-3">Cancel</button></div>
    </fieldset></form> : <div className="mt-7 grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-semibold">Basic Information</h2><dl className="mt-5 space-y-5">{value("Full Name",user.name)}{value("Mobile Number",`+91 ${user.phone}`)}{value("Email",user.email)}{value("Profession",profile.primaryCategory?.name)}</dl><button onClick={edit} className="mt-6 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white">Edit Profile</button></section>
      <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-semibold">Professional Information</h2><dl className="mt-5 space-y-5">{value("Bio",profile.bio)}{value("Experience",`${profile.experienceYears} years`)}{value("City",profile.city)}{value("Service Area",profile.serviceArea)}{value("Starting Price",`₹${profile.startingPrice}`)}</dl></section>
    </div>}
    {error&&<p role="alert" className="mt-5 text-red-700">{error}</p>}{message&&<p role="status" className="mt-5 text-teal-700">{message}</p>}
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-semibold">Account Status</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{value("Verification",verificationLabels[profile.verificationStatus])}{value("Availability",profile.isAvailable?"Available":"Unavailable")}{value("Rating",profile.rating)}{value("Reviews",profile.totalReviews||"No reviews")}</dl></section>
  </div></main></div>;
}
