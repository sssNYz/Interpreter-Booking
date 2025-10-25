"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle,
  LogOut,
  BarChart2,
  Inbox,
  Settings,
  Cog,
  Star,
  DoorOpen,
  Languages,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Admin submenu items
const ADMIN_MENU_ALL = [
  {
    title: "Overview",
    url: "/AdminPage/overview-workload-page",
    icon: BarChart2,
  },
  {
    title: "Bookings management",
    url: "/AdminPage/booking-manage-page",
    icon: Inbox,
  },
  {
    title: "System Management",
    url: "/AdminPage/management-page",
    icon: Settings,
  },
  {
    title: "User management",
    url: "/AdminPage/user-manage-page",
    icon: User,
  },
] as const;

// A clean segmented-control style navbar that:
// - Animates the active highlight to the exact width of the active button
// - Works with the Admin dropdown (no clipping, no z-index issues)
// - Uses portal-based DropdownMenu so the menu renders above the pill
export function AppNavbar() {
  const router = useRouter();
  const pathname = usePathname();

  type Key = "calendar" | "room" | "mybookings" | "admin";

  // Map path → tab key
  const pathToKey = (p?: string): Key => {
    if (!p) return "calendar";
    if (p === "/" || p.startsWith("/BookingPage")) return "calendar";
    if (p.startsWith("/BookingRoomPage")) return "room";
    if (p.startsWith("/MyBookings")) return "mybookings";
    if (p.startsWith("/AdminPage")) return "admin";
    return "calendar";
  };

  // FIX 1: Initialize from current path (no Calendar flash)
  const [active, setActive] = useState<Key>(() => pathToKey(pathname));

  // Refs to measure each button
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<Key, HTMLButtonElement | null>>({
    calendar: null,
    room: null,
    mybookings: null,
    admin: null,
  });

  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });
  const [canAdmin, setCanAdmin] = useState<boolean>(false);
  const [isSuper, setIsSuper] = useState<boolean>(false);
  const onAdminPath = !!pathname && pathname.startsWith("/AdminPage");

  // Update active based on the URL
  useEffect(() => {
    const next = pathToKey(pathname);
    setActive((prev) => (prev === next ? prev : next));
  }, [pathname]);

  // Compute the pill position/size to match the active button
  const updatePill = useCallback(() => {
    const c = containerRef.current;
    const el = btnRefs.current[active];

    if (!c || !el) return;
    const cRect = c.getBoundingClientRect();
    const bRect = el.getBoundingClientRect();
    setPill({ left: bRect.left - cRect.left, width: bRect.width, ready: true });
  }, [active]);

  useEffect(() => {
    updatePill();
    const handle = () => updatePill();
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("resize", handle);
    };
  }, [active, updatePill]);

  // When Admin visibility changes, re-measure if active is admin
  useEffect(() => {
    if (active === "admin") {
      updatePill();
    }
  }, [canAdmin, active, updatePill]);

  // Determine if current user can see Admin menu
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        const roles: string[] = data.roles || [];
        setCanAdmin(roles.includes("ADMIN") || roles.includes("SUPER_ADMIN"));
        setIsSuper(roles.includes("SUPER_ADMIN"));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {}
    try {
      localStorage.removeItem("booking.user");
    } catch {}
    router.push("/login");
  };

  const itemClass = (isActive: boolean) =>
    `relative z-10 h-8 px-4 rounded-full text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ` +
    (isActive
      ? "text-primary-foreground"
      : "text-muted-foreground hover:text-foreground");

  return (
    <nav className="sticky top-0 z-[50] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Interpreter Booking Logo" 
              className="h-8 w-auto"
            />
            <span className="text-lg font-semibold">Interpreter Booking</span>
          </div>

          {/* Segmented nav */}
          <div className="flex items-center gap-2">
            <div
              ref={containerRef}
              className="relative flex items-center gap-1 bg-muted rounded-full p-1 h-10 overflow-hidden"
            >
              {/* Animated highlight */}
              {pill.ready && (
                <motion.div
                  className="absolute top-1 bottom-1 rounded-full bg-neutral-700 z-0"
                  animate={{ left: pill.left, width: pill.width }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              {/* Calendar */}
              <Link href="/BookingPage" className="contents">
                <button
                  ref={(el) => {
                    btnRefs.current.calendar = el;
                  }}
                  className={itemClass(active === "calendar")}
                  onClick={() => setActive("calendar")}
                >
                  <Calendar className="h-4 w-4" />
                  <span>Calendar</span>
                </button>
              </Link>

              {/* Room (hidden by feature flag) */}
              {process.env.NEXT_PUBLIC_ENABLE_ROOM_BOOKING === "1" || process.env.NEXT_PUBLIC_ENABLE_ROOM_BOOKING === "true" ? (
                <Link href="/BookingRoomPage" className="contents">
                  <button
                    ref={(el) => {
                      btnRefs.current.room = el;
                    }}
                    className={itemClass(active === "room")}
                    onClick={() => setActive("room")}
                  >
                    <DoorOpen className="h-4 w-4" />
                    <span>Room</span>
                  </button>
                </Link>
              ) : null}

              {/* My Bookings */}
              <Link href="/MyBookings" className="contents">
                <button
                  ref={(el) => {
                    btnRefs.current.mybookings = el;
                  }}
                  className={itemClass(active === "mybookings")}
                  onClick={() => setActive("mybookings")}
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>My Bookings</span>
                </button>
              </Link>

              {/* Admin (render button on Admin path even before roles load) */}
              {(canAdmin || onAdminPath) && (
                canAdmin ? (
                  <DropdownMenu
                    onOpenChange={(open) => open && setActive("admin")}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        ref={(el) => {
                          btnRefs.current.admin = el;
                        }}
                        className={itemClass(active === "admin")}
                      >
                        <Star className="h-4 w-4" />
                        <span>Admin</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuLabel>Admin</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {ADMIN_MENU_ALL.map((item) => (
                        <DropdownMenuItem key={item.title} asChild>
                          <Link
                            href={item.url}
                            className="flex items-center gap-2 py-2"
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <button
                    ref={(el) => {
                      btnRefs.current.admin = el;
                    }}
                    className={itemClass(active === "admin")}
                    disabled
                  >
                    <Star className="h-4 w-4" />
                    <span>Admin</span>
                  </button>
                )
              )}
            </div>

            {/* Logout */}
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="h-9 flex items-center px-3"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
