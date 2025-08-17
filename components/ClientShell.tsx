"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/slidebar/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

export default function ClientShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const publicPaths = useMemo(() => new Set<string>(["/login", "/LoginPage"]), []);
	const hideSidebar = pathname === "/login" || pathname === "/LoginPage";
	const [ready, setReady] = useState<boolean>(publicPaths.has(pathname));

	useEffect(() => {
		if (publicPaths.has(pathname)) {
			setReady(true);
			return;
		}
		try {
			const raw = typeof window !== "undefined" ? localStorage.getItem("booking.user") : null;
			if (!raw) {
				router.replace("/login");
				return;
			}
			const parsed = JSON.parse(raw);
			const storedAt: number = parsed.storedAt || parsed.timestamp || 0;
			const ttlMs: number = parsed.ttlDays ? parsed.ttlDays * 86400000 : parsed.ttl || 0;
			const expired = !storedAt || !ttlMs || Date.now() > storedAt + ttlMs;
			if (expired) {
				localStorage.removeItem("booking.user");
				router.replace("/login");
				return;
			}
			setReady(true);
		} catch {
			router.replace("/login");
		}
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


