"use client"

import Link from "next/link"
import { Inbox, Calendar, Cog, Users, TestTube, Settings, History } from "lucide-react"

const adminMenuItems = [
  {
    title: "Bookings Management",
    description: "Manage and monitor all booking requests",
    url: "/AdminPage/booking-manage-page",
    icon: Inbox,
    color: "bg-blue-500"
  },
  {
    title: "User Management",
    description: "Manage user accounts and permissions",
    url: "/AdminPage/user-manage-page",
    icon: Users,
    color: "bg-green-500"
  },
  {
    title: "System Management",
    description: "Manage environments, interpreters, and languages",
    url: "/AdminPage/management-page",
    icon: Settings,
    color: "bg-gradient-to-r from-blue-500 to-purple-500"
  },
  {
    title: "Auto-Assignment Config",
    description: "Configure interpreter auto-assignment system",
    url: "/AdminPage/auto-assign-config",
    icon: Cog,
    color: "bg-purple-500"
  },
  {
    title: "Mode Test Simulator",
    description: "Test different assignment modes with real data",
    url: "/AdminPage/mode-test",
    icon: TestTube,
    color: "bg-indigo-500"
  },
  {
    title: "Workload Overview",
    description: "View interpreter workload and assignment analytics",
    url: "/AdminPage/overview-workload-page",
    icon: Calendar,
    color: "bg-orange-500"
  },
  {
    title: "Backfill Booking",
    description: "Record past bookings (admin only)",
    url: "/AdminPage/backfill-booking",
    icon: History,
    color: "bg-red-500"
  }
]

export default function AdminPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 text-lg">
          Manage your interpreter booking system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {adminMenuItems.map((item) => (
          <Link
            key={item.title}
            href={item.url}
            className="block p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 bg-white border border-gray-100"
          >
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${item.color}`}>
                <item.icon className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600">
                  {item.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Quick Stats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Total Bookings</h3>
            <p className="text-2xl font-bold text-gray-900">-</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Active Interpreters</h3>
            <p className="text-2xl font-bold text-gray-900">-</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Auto-Assignments</h3>
            <p className="text-2xl font-bold text-gray-900">-</p>
          </div>
        </div>
      </div>
    </div>
  )
}
