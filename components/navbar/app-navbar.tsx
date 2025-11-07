"use client";

import Link from "next/link";
import Image from "next/image";
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
  History,
  DoorOpen,
  Languages,
  User,
  ChevronsUpDown,
  Phone,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
    title: "Backfill booking",
    url: "/AdminPage/backfill-booking",
    icon: History,
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

  // User profile from localStorage
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userEmpCode, setUserEmpCode] = useState<string>("");
  const [userPhone, setUserPhone] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("booking.user");
      if (!raw) return;
      const u = JSON.parse(raw) as { name?: string; email?: string | null; empCode?: string; phone?: string | null };
      setUserName(String(u.name || ""));
      setUserEmail(u.email || "");
      setUserEmpCode(String(u.empCode || ""));
      setUserPhone(u.phone ?? null);
    } catch {}
  }, []);

  // Change phone dialog state
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const openPhoneDialog = () => {
    setNewPhone(String(userPhone || ""));
    setPhoneOpen(true);
  };
  const handleSavePhone = async () => {
    const v = newPhone.trim();
    if (!/^[0-9]{4}$/.test(v)) {
      toast.error("Please enter exactly 4 digits");
      return;
    }
    setSavingPhone(true);
    try {
      const r = await fetch("/api/user/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telExt: v }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        toast.error(j?.message || "Failed to update phone");
        return;
      }
      try {
        const raw = localStorage.getItem("booking.user");
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.phone = v;
        localStorage.setItem("booking.user", JSON.stringify(parsed));
      } catch {}
      setUserPhone(v);
      setPhoneOpen(false);
      toast.success("Phone updated");
    } finally {
      setSavingPhone(false);
    }
  };

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
      <div className="w-full flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
            <Image 
              src="/logo/BOOKIO.svg" 
              alt="Logo" 
              width={50} 
              height={50}
              className="h-auto w-auto max-h-10"
            />
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

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-2 flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{(userName || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-medium max-w-[160px] truncate">{userName || "User"}</span>
                    <span className="text-xs text-muted-foreground max-w-[160px] truncate">{userEmail || ""}</span>
                  </div>
                  <ChevronsUpDown className="ml-1 h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-60">
                <DropdownMenuLabel className="p-0">
                  <div className="flex items-center gap-2 px-2 py-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{(userName || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="grid text-sm leading-tight">
                      <span className="font-medium">{userName || "User"}</span>
                      <span className="text-xs text-muted-foreground">{userEmail || ""}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openPhoneDialog}>
                  <Phone className="h-4 w-4 mr-2" />
                  Change phone
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </div>
      {/* Change phone dialog */}
      <Dialog open={phoneOpen} onOpenChange={setPhoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change phone (4 digits)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              inputMode="numeric"
              pattern="[0-9]{4}"
              title="Please enter exactly 4 digits"
              maxLength={4}
              placeholder="1234"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePhone} disabled={savingPhone}>
              {savingPhone ? "Saving..." : "Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
