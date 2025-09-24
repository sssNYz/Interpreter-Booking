"use client"

import AutoAssignConfig from "@/components/AdminControls/AutoAssignConfig"

export default function AutoAssignConfigPage() {
  return (
    <div className="container mx-auto p-1 space-y-1">
      <div className="text-center">
      </div>

      {/* Configuration Panel - Full Width */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Environment Configuration
        </h2>
        <AutoAssignConfig />
      </div>

    </div>
  )
}
