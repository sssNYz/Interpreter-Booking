"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/slidebar/app-sidebar";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const hideSidebar = pathname === "/login" || pathname === "/LoginPage";
  
  useEffect(() => {
    const publicPaths = new Set<string>(["/login", "/LoginPage"]);
    if (publicPaths.has(pathname)) return;
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
      }
    } catch {
      router.replace("/login");
    }
  }, [pathname, router]);
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SidebarProvider>
          {!hideSidebar && <AppSidebar />}
          <SidebarInset>
            <main className="min-h-screen p-4">
              {!hideSidebar && <SidebarTrigger className="mb-4" />}
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
