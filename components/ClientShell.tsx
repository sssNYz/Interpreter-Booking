"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/slidebar/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

export default function ClientShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const publicPaths = useMemo(() => new Set<string>(["/login"]), []);
	const hideSidebar = pathname === "/login";	
	const [ready, setReady] = useState<boolean>(publicPaths.has(pathname));

	useEffect(() => {
		if (publicPaths.has(pathname)) {
			setReady(true);
			return;
		}
		// Ask server if session cookie is valid and refresh sliding TTL
		fetch("/api/session/status?refresh=1", { credentials: "include" })
			.then(async (r) => {
				if (!r.ok) throw new Error("no session");
				return r.json();
			})
			.then(() => setReady(true))
			.catch(() => {
				try { localStorage.removeItem("booking.user"); } catch {}
				router.replace("/login");
			});
	}, [pathname, publicPaths, router]);

	return (
		<SidebarProvider>
			{!hideSidebar && <AppSidebar />}
			<SidebarInset>
				<main className="min-h-screen p-4">
					{!hideSidebar && <SidebarTrigger className="mb-4" />}
					{ready ? children : null}
				</main>
			</SidebarInset>
			<Toaster position="top-center" offset={50} />
		</SidebarProvider>
	);
}


