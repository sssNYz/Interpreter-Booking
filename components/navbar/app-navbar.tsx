"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { BarChart2, Calendar, Home, Inbox, Settings, LayoutDashboard, Star, LogOut, Cog } from "lucide-react"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Admin submenu items
const adminItems = [
  { title: "Overview", url: "/AdminPage/overview-workload-page", icon: BarChart2 },
  { title: "Bookings management", url: "/AdminPage/booking-manage-page", icon: Inbox },
  { title: "Interpreters management", url: "#", icon: Calendar },
  { title: "User management", url: "/AdminPage/user-manage-page", icon: Settings },
  { title: "Auto-Assignment Config", url: "/AdminPage/auto-assign-config", icon: Cog },
]

export function AppNavbar() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" })
    } catch {}
    try {
      localStorage.removeItem("booking.user")
    } catch {}
    router.push("/login")
  }

  return (
    <nav className="sticky top-0 z-[70] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" />
            <span className="text-lg font-semibold">Interpreter Booking</span>
          </div>

          {/* Navigation Menu */}
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="flex items-center gap-1">
              {/* Home */}
              <NavigationMenuItem>
                <Link href="/" legacyBehavior passHref>
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "flex items-center")}>
                    <Home className="h-4 w-4 mr-2" />
                    Home
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              {/* Booking */}
              <NavigationMenuItem>
                <Link href="/BookingPage" legacyBehavior passHref>
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "flex items-center")}>
                    <Inbox className="h-4 w-4 mr-2" />
                    Booking
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              {/* Admin Dropdown */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className="flex items-center">
                  <Star className="h-4 w-4 mr-2" />
                  Admin
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid min-w-[260px] w-[300px] md:w-[360px] gap-2 p-2">
                    {adminItems.map((item) => (
                      <li key={item.title}>
                        <NavigationMenuLink asChild>
                          <Link href={item.url} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span className="text-sm font-medium leading-none">
                              {item.title}
                            </span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Logout */}
              <NavigationMenuItem>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className={cn(navigationMenuTriggerStyle(), "h-9 flex items-center")}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </div>
    </nav>
  )
}
