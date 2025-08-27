"use client"

import AutoAssignConfig from "@/components/AdminControls/AutoAssignConfig"
import AssignmentCandidates from "@/components/AdminControls/AssignmentCandidates"

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            System Configuration
          </h2>
          <AutoAssignConfig />
        </div>

        {/* Diagnostic Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Assignment Diagnostics
          </h2>
          <AssignmentCandidates />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-800 mb-2">
          How Auto-Assignment Works
        </h3>
        <ul className="text-blue-700 space-y-1 text-sm">
          <li>• <strong>Fairness Score:</strong> Favors interpreters with fewer assigned hours</li>
          <li>• <strong>Urgency Score:</strong> Favors bookings closer to start time</li>
          <li>• <strong>LRS Score:</strong> Favors interpreters who haven&apos;t been assigned recently</li>
          <li>• <strong>Hard Guardrail:</strong> Prevents excessive hour gaps between interpreters</li>
        </ul>
      </div>
    </div>
  )
}
