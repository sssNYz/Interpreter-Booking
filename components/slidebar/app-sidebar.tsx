"use client"

import { Calendar, Home, Inbox, Search, Settings, ChevronRight,LayoutDashboard,Star} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// Submenu for Admin
const adminItems = [
  { title: "Overview", url: "/admin-page", icon: Home },
  { title: "Bookings management", url: "#", icon: Inbox },
  { title: "Interpreters management", url: "#", icon: Calendar },
  { title: "Reports", url: "#", icon: Search },
  { title: "Settings", url: "#", icon: Settings },
]

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6" />
              <span>Main Menu</span>
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>

              {/* 🏠 Home */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="./">
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* 🏠 TEST */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/Test-calendar">
                    <Home className="h-4 w-4" />
                    <span>TEST</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* 📦 Booking */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/booking-page">
                    <Inbox className="h-4 w-4" />
                    <span>Booking</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* 🛠 Admin + Collapsible Submenu */}
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  {/* Trigger */}
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Star className="h-4 w-4 mr-2" />
                      Admin controller
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  {/* Submenu */}
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {adminItems.map((item) => (
                        <SidebarMenuSubItem key={item.title} >
                          <a href={item.url} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            {item.title}
                          </a>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
