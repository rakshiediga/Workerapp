import {AuthGuard} from "@/components/auth-guard";
export default function JobRequestsLayout({children}: {children: React.ReactNode}) {return <AuthGuard>{children}</AuthGuard>;}
