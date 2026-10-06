"use client";
import Link from "next/link";
import { useState } from "react";
import { useMarketplace } from "@/lib/use-marketplace";
import type { Category } from "@/lib/marketplace";
export function CategoryCards() {
 const { data, loading, error, retry } = useMarketplace<{ categories: Category[] }>("/api/categories");
 const [search, setSearch] = useState("");
 const categories = data?.categories.filter(category => `${category.name} ${category.description || ""}`.toLowerCase().includes(search.trim().toLowerCase())) || [];
 return <section aria-label="Service categories">
  <label htmlFor="service-search" className="sr-only">Search for a service</label><input id="service-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search for a service..." className="mb-6 w-full rounded-xl border border-gray-300 bg-white px-5 py-4 text-gray-900 focus:outline-blue-600" />
  {loading ? <p role="status">Loading services...</p> : error ? <div role="alert" className="rounded-xl bg-white p-6"><p>Unable to load services. {error}</p><button onClick={retry} className="mt-4 text-blue-600">Retry</button></div> : categories.length === 0 ? <p className="rounded-xl border bg-white p-8 text-center">{data?.categories.length ? "No services found. Try another search." : "No services available yet."}</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{categories.map(category => <article key={category.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
   <div aria-hidden="true" className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-2xl">{"\uD83D\uDEE0\uFE0F"}</div><h2 className="text-xl font-semibold text-gray-900">{category.name}</h2><p className="mb-6 mt-2 flex-1 text-sm text-gray-600">{category.description || `Browse ${category.name.toLowerCase()} services.`}</p>
   <Link href={`/workers?category=${encodeURIComponent(category.slug)}`} className="rounded-lg bg-blue-600 px-4 py-3 text-center font-semibold text-white hover:bg-blue-700">Find Workers</Link>
  </article>)}</div>}
 </section>;
}
