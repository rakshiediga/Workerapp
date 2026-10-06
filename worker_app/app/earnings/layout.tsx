import {AuthGuard} from "@/components/auth-guard";
export default function EarningsLayout({children}: {children:React.ReactNode}) {return <AuthGuard>{children}</AuthGuard>;}
