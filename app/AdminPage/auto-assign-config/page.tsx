"use client"

import AutoAssignConfig from "@/components/AdminControls/AutoAssignConfig"

export default function AutoAssignConfigPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Auto-Assignment Configuration
        </h1>
        <p className="text-gray-600">
          Configure and monitor the interpreter auto-assignment system
        </p>
      </div>

      {/* Configuration Panel - Full Width */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          System Configuration
        </h2>
        <AutoAssignConfig />
      </div>

    </div>
  )
}
