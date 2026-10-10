import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/modules/dashboard/ui/components/dashboard-sidebar";
import { DashboardNavbar } from "@/modules/dashboard/ui/components/dasshboard-navbar";

interface Props {
    children: React.ReactNode;
}

const Layout = async ({ children }: Props) => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/sign-in");
    }

    return (
        <SidebarProvider>
            <DashboardSidebar />
            <main id="main-content" className="flex flex-col min-h-screen w-full flex-1 min-w-0 bg-muted overflow-y-auto">
                <DashboardNavbar />
                {children}
            </main>
        </SidebarProvider>
    );
};

export default Layout;