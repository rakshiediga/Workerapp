"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth-provider";
import { safeReturnPath } from "@/lib/auth";
export function AuthForm({ registering = false }: { registering?: boolean }) {
  const { user, loading, login, register, error: sessionError } = useAuth();
  const router = useRouter();
  const [fields, setFields] = useState({ name: "", phone: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const signedInHere = useRef(false);
  useEffect(() => { if (!loading && user && !signedInHere.current) router.replace("/services"); }, [loading, user, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (registering && !fields.name.trim()) { setError("Enter your full name."); return; }
    if (!/^\d{10}$/.test(fields.phone)) { setError("Enter a 10-digit mobile number."); return; }
    if (registering && fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) { setError("Enter a valid email address."); return; }
    if (fields.password.length < 8 || !fields.password.trim()) { setError("Password must contain at least 8 characters."); return; }
    if (new TextEncoder().encode(fields.password).length > 72) { setError("Password must be no more than 72 bytes."); return; }
    if (registering && fields.password !== fields.confirmPassword) { setError("Passwords do not match."); return; }
    submitting.current = true; signedInHere.current = true; setBusy(true); setError("");
    try {
      const next = registering ? "/services" : safeReturnPath(new URLSearchParams(window.location.search).get("next"));
      if (registering) await register({ name: fields.name.trim(), phone: fields.phone, ...(fields.email.trim() ? { email: fields.email.trim() } : {}), password: fields.password });
      else await login({ phone: fields.phone, password: fields.password });
      router.replace(next);
    } catch (cause) { signedInHere.current = false; setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  const inputClass = "mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:outline-blue-600";
  function field(key: keyof typeof fields, label: string, type = "text", maxLength?: number) {
    return <label htmlFor={`auth-${key}`} className="block text-sm font-medium text-gray-700">{label}<input id={`auth-${key}`} type={type} required={key !== "email"} maxLength={maxLength} autoComplete={key === "password" || key === "confirmPassword" ? registering ? "new-password" : "current-password" : key === "phone" ? "tel-national" : key} inputMode={key === "phone" ? "numeric" : undefined} value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: key === "phone" ? event.target.value.replace(/\D/g, "").slice(0, 10) : event.target.value })} className={inputClass} /></label>;
  }
  if (loading || user) return <p role="status" className="p-8">Checking your session...</p>;
  return <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10"><div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
    <Link href="/" className="text-sm text-blue-600">? Back to Home</Link>
    <h1 className="mt-6 text-3xl font-bold text-gray-900">{registering ? "Create Account" : "Welcome Back"}</h1>
    <p className="mb-8 mt-2 text-gray-500">{registering ? "Register to book trusted workers near you." : "Login to book trusted workers near you."}</p>
    <form onSubmit={submit} noValidate className="space-y-5">
      {registering && field("name", "Full Name", "text", 100)}
      <p className="text-sm text-gray-500">Indian mobile number (+91)</p>
      {field("phone", "Mobile Number", "tel", 10)}
      {registering && field("email", "Email (optional)", "email", 254)}
      {field("password", "Password", showPassword ? "text" : "password")}
      <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="rounded text-sm font-medium text-blue-600">{showPassword ? "Hide Password" : "Show Password"}</button>
      {registering && field("confirmPassword", "Confirm Password", showPassword ? "text" : "password")}
      {(error || sessionError) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error || sessionError}</p>}
      <button disabled={busy} type="submit" className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{busy ? registering ? "Creating Account..." : "Logging in..." : registering ? "Create Account" : "Login"}</button>
    </form>
    <p className="mt-6 text-center text-sm text-gray-500">{registering ? "Already have an account?" : "New customer?"} <Link href={registering ? "/login" : "/register"} className="font-semibold text-blue-600">{registering ? "Login" : "Create Account"}</Link></p>
  </div></main>;
}
