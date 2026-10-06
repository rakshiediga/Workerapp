import {AuthGuard} from "@/components/auth-guard";
export default function VerificationLayout({children}:{children:React.ReactNode}){return <AuthGuard>{children}</AuthGuard>;}
