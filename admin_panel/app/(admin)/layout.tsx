import {AdminAuthGuard} from "@/components/admin/AdminAuthGuard";
import {AdminLayout} from "@/components/admin/AdminLayout";
export default function Layout({children}:{children:React.ReactNode}){return <AdminAuthGuard><AdminLayout>{children}</AdminLayout></AdminAuthGuard>;}
