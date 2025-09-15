"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppNavbar } from "@/components/navbar/app-navbar";
import { Toaster } from "@/components/ui/sonner";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const publicPaths = useMemo(() => new Set<string>(["/login"]), []);
  const hideNavbar = pathname === "/login";
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
        try {
          localStorage.removeItem("booking.user");
        } catch {}
        router.replace("/login");
      });
  }, [pathname, publicPaths, router]);

  return (
    <div className="min-h-screen flex flex-col">
      {!hideNavbar && <AppNavbar />}
      <main className="flex-1 p-4">{ready ? children : null}</main>
      <Toaster position="top-center" offset={50} />
    </div>
  );
}
