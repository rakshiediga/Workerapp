import {AuthGuard} from "@/components/auth-guard";
export default function AvailabilityLayout({children}:{children:React.ReactNode}){return <AuthGuard>{children}</AuthGuard>;}
