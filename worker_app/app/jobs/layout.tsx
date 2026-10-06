import {AuthGuard} from "@/components/auth-guard";
export default function JobsLayout({children}: {children: React.ReactNode}) {return <AuthGuard>{children}</AuthGuard>;}
