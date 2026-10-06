import type {Metadata} from "next";
import "./globals.css";
import {AdminAuthProvider} from "@/components/admin/AdminAuthProvider";
export const metadata:Metadata={title:{default:"WorkerBooking Admin",template:"%s | WorkerBooking Admin"},description:"WorkerBooking administration interface"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AdminAuthProvider>{children}</AdminAuthProvider></body></html>;}
