import {AuthGuard} from "@/components/auth-guard";
export default function ServicesLayout({children}:{children:React.ReactNode}){return <AuthGuard>{children}</AuthGuard>;}
