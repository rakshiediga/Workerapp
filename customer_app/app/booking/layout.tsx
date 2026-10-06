import { AuthGuard } from "@/app/auth-guard";
import { CustomerNav } from "@/app/customer-nav";
import Link from "next/link";
import type { ReactNode } from "react";

export default function BookingLayout({ children }: { children: ReactNode }) {
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600";
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link href="/" className={`rounded text-2xl font-bold text-blue-600 ${focus}`}>WorkerBooking</Link>
          <CustomerNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12"><AuthGuard>{children}</AuthGuard></main>
    </div>
  );
}
