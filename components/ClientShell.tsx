"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppNavbar } from "@/components/navbar/app-navbar";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

type SessionStatus = { ok: boolean; user?: { empCode: string }; expiresAt?: number };

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const publicPaths = useMemo(() => new Set<string>(["/login", "/setup/phone"]), []);
  const hideNavbar = pathname === "/login";
  const [ready, setReady] = useState<boolean>(publicPaths.has(pathname));
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const warnedRef = useRef(false);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const installedFetchRef = useRef(false);
  const handlingExpiryRef = useRef(false);

  const clearTimers = () => {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
    warnTimerRef.current = null;
    expireTimerRef.current = null;
  };

  const handleExpired = (reason: "401" | "timeout") => {
    if (handlingExpiryRef.current) return;
    handlingExpiryRef.current = true;
    try {
      localStorage.removeItem("booking.user");
    } catch {}
    const url = new URL(window.location.href);
    const returnUrl = url.pathname + url.search;
    toast.dismiss();
    toast.error("Your session has expired. Please sign in again.");
    // Small delay so users can see the toast before redirect
    setTimeout(() => {
      router.replace(`/login?expired=1&returnUrl=${encodeURIComponent(returnUrl)}`);
    }, 1200);
  };

  const refreshSession = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < 60000) return; // throttle refresh to once per minute
    lastRefreshRef.current = now;
    try {
      const r = await fetch("/api/session/status?refresh=1", { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error("no session");
      const j = (await r.json()) as SessionStatus;
      if (!j.ok || !j.expiresAt) throw new Error("bad");
      warnedRef.current = false;
      setExpiresAt(j.expiresAt);
      setReady(true);
    } catch {
      handleExpired("401");
    }
  };

  // Initial check + refresh on route change
  useEffect(() => {
    if (publicPaths.has(pathname)) {
      setReady(true);
      return;
    }
    (async () => {
      await refreshSession();
      try {
        // Hard block if no phone set
        const r = await fetch("/api/user/profile", { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { ok: boolean; user?: { phone?: string | null } };
          const phone = j?.user?.phone ?? null;
          if (!phone) {
            router.replace("/setup/phone");
            return;
          }
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Install global fetch 401 handler once
  useEffect(() => {
    if (installedFetchRef.current) return;
    installedFetchRef.current = true;
    const orig = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await orig(...args);
      if (res.status === 401 && !publicPaths.has(pathname)) {
        handleExpired("401");
      }
      return res;
    };
    return () => {
      window.fetch = orig;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn 2 minutes before expiry and auto-redirect on expiry
  useEffect(() => {
    clearTimers();
    if (!expiresAt || publicPaths.has(pathname)) return;

    const msLeft = expiresAt - Date.now();
    if (msLeft <= 0) {
      handleExpired("timeout");
      return;
    }

    const warnIn = Math.max(0, msLeft - 2 * 60 * 1000);
    warnTimerRef.current = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true;
        const minutes = Math.max(1, Math.floor((expiresAt - Date.now()) / 60000));
        const id = toast.warning(`Session will expire in ~${minutes} minute${minutes > 1 ? "s" : ""}.`, {
          action: {
            label: "Stay signed in",
            onClick: () => refreshSession(true),
          },
          duration: 120000,
        });
        const handler = () => {
          toast.dismiss(id);
          refreshSession(true);
          window.removeEventListener("click", handler);
          window.removeEventListener("keydown", handler);
          window.removeEventListener("touchstart", handler);
        };
        window.addEventListener("click", handler, { once: true });
        window.addEventListener("keydown", handler, { once: true });
        window.addEventListener("touchstart", handler, { once: true });
      }
    }, warnIn);

    expireTimerRef.current = setTimeout(() => handleExpired("timeout"), msLeft);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, pathname]);

  // Refresh on user activity (sliding TTL only when active)
  useEffect(() => {
    if (publicPaths.has(pathname)) return;
    const onActivity = () => refreshSession();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("click", onActivity, opts);
    window.addEventListener("keydown", onActivity, opts);
    window.addEventListener("mousemove", onActivity, opts);
    window.addEventListener("scroll", onActivity, opts);
    window.addEventListener("touchstart", onActivity, opts);
    return () => {
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      {!hideNavbar && <AppNavbar />}
      <main className="flex-1 min-h-0 overflow-y-auto p-0">{ready ? children : null}</main>
      <Toaster position="top-center" offset={50} />
    </div>
  );
}
