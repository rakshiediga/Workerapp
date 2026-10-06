import Link from "next/link";
import { WorkerHeader } from "@/components/worker-header";
const benefits = [
  ["Find More Customers", "Receive nearby service requests."],
  ["Flexible Working", "Choose when you're available."],
  ["Grow Your Earnings", "Build your customer base."],
  ["Build Your Reputation", "Earn ratings and reviews."],
];
const steps = ["Create Your Profile", "Add Your Services", "Get Verified", "Receive Job Requests", "Complete Jobs & Earn"];
export default function HomePage() {
  return <><WorkerHeader /><main>
    <section className="bg-teal-950 text-white"><div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-24 lg:grid-cols-[1.4fr_1fr] lg:items-center">
      <div><p className="text-sm font-semibold uppercase tracking-widest text-teal-300">Your skills. Your business.</p><h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Grow Your Business with WorkerBooking</h1><p className="mt-6 max-w-xl text-lg leading-8 text-teal-100">Find nearby customers, manage service requests, and grow your earnings.</p><div className="mt-8 flex flex-wrap gap-4"><Link href="/register" className="rounded-lg bg-white px-6 py-3 font-semibold text-teal-950 hover:bg-teal-50">Join as a Worker</Link><Link href="/login" className="rounded-lg border border-teal-600 px-6 py-3 font-semibold hover:bg-teal-900">Worker Login</Link></div></div>
      <div className="rounded-2xl border border-teal-700 bg-teal-900 p-7"><p className="text-sm font-semibold text-teal-300">BUILT FOR SERVICE PROFESSIONALS</p><h2 className="mt-4 text-2xl font-bold">Turn your expertise into opportunity.</h2><p className="mt-4 leading-7 text-teal-100">From plumbing and electrical work to cleaning and appliance repair, bring your skills to customers who need them.</p><p className="mt-6 border-t border-teal-700 pt-5 text-sm text-teal-200">Start with the basics. Build your profile one step at a time.</p></div>
    </div></section>
    <section className="mx-auto max-w-6xl px-5 py-16"><h2 className="text-3xl font-bold">Why Join WorkerBooking?</h2><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{benefits.map(([title, description], index) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6"><span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 font-bold text-teal-700">0{index + 1}</span><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-3 leading-6 text-slate-600">{description}</p></article>)}</div></section>
    <section className="border-t border-slate-200 bg-white"><div className="mx-auto max-w-6xl px-5 py-16"><h2 className="text-3xl font-bold">How It Works</h2><ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">{steps.map((step, index) => <li key={step}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 font-semibold text-white">{index + 1}</span><h3 className="mt-4 font-semibold">{step}</h3></li>)}</ol></div></section>
  </main><footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-slate-500">WorkerBooking · Worker & Partner Portal</footer></>;
}
