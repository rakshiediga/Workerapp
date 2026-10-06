"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { apiFetch } from "@/lib/api";
import { safeReturnPath } from "@/lib/auth";
const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 focus:outline-teal-700";
export function WorkerAccountForm({ registering = false }: { registering?: boolean }) {
  const {user, loading, login, register} = useAuth(); const router = useRouter();
  const [professions, setProfessions] = useState<{id: string; name: string; slug: string}[]>([]);
  const [professionsLoading, setProfessionsLoading] = useState(registering);
  const [professionError, setProfessionError] = useState("");
  const [revision, setRevision] = useState(0);
  const [submitting, setSubmitting] = useState(false); const submittingRef = useRef(false);
  useEffect(() => { if (!loading && user) router.replace("/dashboard"); }, [user, loading, router]);
  useEffect(() => {
    if (!registering) return;
    const controller = new AbortController(); let active = true;
    queueMicrotask(() => { if (active) {setProfessionsLoading(true); setProfessionError("");} });
    apiFetch<{data: {categories: typeof professions}}>("/api/categories", {signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])}, false)
      .then(result => {if (active) setProfessions(result.data.categories);})
      .catch(cause => {if (active) setProfessionError(cause instanceof Error ? cause.message : "Unable to load professions.");})
      .finally(() => {if (active) setProfessionsLoading(false);});
    return () => {active = false; controller.abort();};
  }, [registering, revision]);
  const [fields, setFields] = useState({ name: "", phone: "", profession: "", city: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submittingRef.current) return; setError("");
    if (registering && !fields.name.trim()) { setError("Full Name is required."); return; }
    if (!/^\d{10}$/.test(fields.phone)) { setError("Mobile Number must contain exactly 10 digits."); return; }
    if (registering && !fields.profession) { setError("Select your profession."); return; }
    if (registering && !fields.city.trim()) { setError("City is required."); return; }
    if (fields.password.length < 8 || !fields.password.trim()) { setError("Password must contain at least 8 characters."); return; }
    if (registering && fields.password !== fields.confirmPassword) { setError("Passwords must match."); return; }
    if (registering && (professionsLoading || professionError)) { setError("Load professions before creating your account."); return; }
    submittingRef.current = true; setSubmitting(true);
    try {
      if (registering) await register({name: fields.name.trim(), phone: fields.phone, profession: fields.profession, city: fields.city.trim(), password: fields.password});
      else await login({phone: fields.phone, password: fields.password});
      router.replace(registering ? "/dashboard" : safeReturnPath(new URLSearchParams(window.location.search).get("next")));
    } catch (cause) {setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");}
    finally {submittingRef.current = false; setSubmitting(false);}
  }
  const field = (key: keyof typeof fields, label: string, type = "text", maxLength = 100) => <label htmlFor={`worker-${key}`} className="block text-sm font-medium">{label}<input id={`worker-${key}`} name={key} type={type} required maxLength={maxLength} autoComplete={key === "name" ? "name" : key === "city" ? "address-level2" : key === "password" ? registering ? "new-password" : "current-password" : key === "confirmPassword" ? "new-password" : undefined} value={fields[key]} onChange={event => setFields({ ...fields, [key]: event.target.value })} className={inputClass} /></label>;
  return <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <p className="text-sm font-semibold text-teal-700">WORKER PORTAL</p><h1 className="mt-3 text-3xl font-bold">{registering ? "Join as a Worker" : "Worker Login"}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{registering ? "Start with your basic information. Services, pricing, availability, and verification come later." : "Manage your service business in one place."}</p>
    {loading || user ? <p role="status" className="mt-5">Checking worker session...</p> : <>
    <form onSubmit={submit} noValidate className="mt-6 space-y-5">
      <fieldset disabled={submitting} className="space-y-5">
      {registering && field("name", "Full Name")}
      <label htmlFor="worker-phone" className="block text-sm font-medium">Mobile Number<div className="mt-2 flex overflow-hidden rounded-lg border border-slate-300"><span className="bg-slate-50 px-3 py-3 text-slate-500">+91</span><input id="worker-phone" type="tel" inputMode="numeric" autoComplete="tel-national" required maxLength={10} value={fields.phone} onChange={event => setFields({ ...fields, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} className="min-w-0 flex-1 px-3 py-3 focus:outline-teal-700" /></div></label>
      {registering && <><label htmlFor="worker-profession" className="block text-sm font-medium">Profession<select id="worker-profession" required disabled={professionsLoading || !!professionError} value={fields.profession} onChange={event => setFields({ ...fields, profession: event.target.value })} className={inputClass}><option value="">{professionsLoading ? "Loading professions..." : "Select your profession"}</option>{professions.map(profession => <option key={profession.id} value={profession.slug}>{profession.name}</option>)}</select></label>{professionError && <p role="alert" className="text-sm text-red-700">{professionError}<button type="button" onClick={() => setRevision(value => value + 1)} className="ml-3 font-semibold">Retry</button></p>}{!professionsLoading && !professionError && professions.length === 0 && <p className="text-sm text-slate-600">No professions available yet.</p>}{field("city", "City")}</>}
      {field("password", "Password", showPassword ? "text" : "password", 128)}
      {registering && field("confirmPassword", "Confirm Password", showPassword ? "text" : "password", 128)}
      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} className="text-sm font-semibold text-teal-700">{showPassword ? "Hide Password" : "Show Password"}</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={submitting || (registering && (professionsLoading || !!professionError || !professions.length))} className="w-full rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800">{submitting ? registering ? "Creating Account..." : "Logging in..." : registering ? "Create Worker Account" : "Login"}</button>
      </fieldset>
    </form><p className="mt-6 text-center text-sm text-slate-600"><Link href={registering ? "/login" : "/register"} className="font-semibold text-teal-700 hover:underline">{registering ? "Already a worker? Login" : "New worker? Register"}</Link></p></>}
  </div>;
}
