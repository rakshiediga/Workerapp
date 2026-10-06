import Link from "next/link";
import { CustomerNav } from "../customer-nav";
import { CategoryCards } from "./category-cards";
export default function ServicesPage() { return <div className="min-h-screen bg-gray-50 text-gray-900"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6"><Link href="/" className="text-2xl font-bold text-blue-600">WorkerBooking</Link><CustomerNav /></div></header><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><div className="mb-8 text-center"><h1 className="text-3xl font-bold sm:text-4xl">What service do you need?</h1><p className="mt-3 text-gray-600">Explore services for your home and vehicle.</p></div><CategoryCards /></main></div>; }
