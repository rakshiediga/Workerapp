"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent } from "react";
import { CustomerNav } from "../customer-nav";
import { useMarketplace } from "@/lib/use-marketplace";
import { money, profession, type Category, type PublicWorker } from "@/lib/marketplace";
function WorkersContent() {
 const params = useSearchParams();
 const router = useRouter();
 const category = params.get("category") || "";
 const service = params.get("service") || "";
 const availability = params.get("availability") || "";
 const sort = params.get("sort") || "rating";
 const { data: catalogue } = useMarketplace<{ categories: Category[] }>("/api/categories");
 const query = new URLSearchParams();
 if (category) query.set("category", category);
 if (service) query.set("service", service);
 if (availability) query.set("availability", availability);
 query.set("sort", sort);
 const { data, loading, error, retry } = useMarketplace<{ workers: PublicWorker[] }>(`/api/workers?${query}`);

 function update(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key,value); else next.delete(key); router.push(`/workers?${next}`); }
 function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const selectedCategory = String(new FormData(event.currentTarget).get("category") || ""); const next = new URLSearchParams(params); next.delete("service"); if (selectedCategory) next.set("category", selectedCategory); else next.delete("category"); router.push(`/workers?${next}`); }
 const categoryName = catalogue?.categories.find(item => item.slug === category)?.name;
 return <><h1 className="text-3xl font-bold sm:text-4xl">{categoryName ? `${categoryName} Workers` : "Find Workers"}</h1>
 <form onSubmit={search} className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl border bg-white p-6"><label className="flex-1 text-sm font-medium">Category<select key={category} name="category" defaultValue={category} className="mt-2 block w-full rounded-lg border p-3"><option value="">All categories</option>{catalogue?.categories.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label><button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">Search Workers</button></form>
 <div className="my-6 flex flex-wrap gap-4"><label className="text-sm">Availability<select value={availability} onChange={event => update("availability",event.target.value)} className="ml-2 rounded-lg border bg-white p-2"><option value="">All</option><option value="true">Available</option><option value="false">Currently unavailable</option></select></label><label className="text-sm">Sort<select value={sort} onChange={event => update("sort",event.target.value)} className="ml-2 rounded-lg border bg-white p-2"><option value="rating">Highest rating</option><option value="price">Lowest starting price</option><option value="experience">Most experience</option></select></label>{service && <p className="text-sm">Service: {service} <Link href={`/workers?category=${encodeURIComponent(category)}`} className="text-blue-600">Clear</Link></p>}</div>
 {loading ? <p role="status">Loading workers...</p> : error ? <div role="alert"><p>Unable to load workers. {error}</p><button onClick={retry} className="mt-3 text-blue-600">Retry</button></div> : !data?.workers.length ? <div className="rounded-2xl border bg-white p-10 text-center"><p>No workers found for this service.</p><Link href="/services" className="mt-4 inline-block text-blue-600">View All Services</Link></div> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{data.workers.map(worker => <article key={worker.id} className="rounded-2xl border bg-white p-6 shadow-sm"><div aria-hidden="true" className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">{worker.name.split(" ").map(part=>part[0]).slice(0,2).join("")}</div><h2 className="text-xl font-semibold">{worker.name}</h2><p className="mt-1 text-gray-600">{profession(worker)}</p><p className="mt-3">{"\u2B50"} {worker.rating} ({worker.totalReviews} reviews)</p><p className="mt-2 text-sm text-gray-600">{worker.experienceYears} years experience</p><p className="mt-4 font-semibold">Starting from {money(worker.startingPrice)}</p><p className={`mt-3 inline-block rounded-full px-3 py-1 text-sm ${worker.isAvailable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{worker.isAvailable ? "Available" : "Currently Unavailable"}</p><Link href={`/workers/${worker.id}`} className="mt-5 block rounded-lg bg-blue-600 py-3 text-center font-semibold text-white">View Profile</Link></article>)}</div>}
 </>;
}
export default function WorkersPage() { return <div className="min-h-screen bg-gray-50 text-gray-900"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6"><Link href="/" className="text-2xl font-bold text-blue-600">WorkerBooking</Link><CustomerNav /></div></header><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><Suspense fallback={<p role="status">Loading workers...</p>}><WorkersContent /></Suspense></main></div>; }
