"use client"

import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";
import InterpreterColorManager from "@/components/AdminControls/interpreter-color-manager";

export default function AdminPageInterpreterManagement() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/user/me', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!alive) return;
        const roles: string[] = data?.user?.roles || [];
        setAllowed(roles.includes('ADMIN') || roles.includes('SUPER_ADMIN'));
      }).catch(() => setAllowed(false));
    return () => { alive = false };
  }, []);

  if (allowed === null) return null; // or loading
  if (!allowed) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Forbidden</div>
  );
  return (
    <div className="min-h-screen bg-[#f7f7f7] font-sans text-gray-900">
      {/* Header */}
      <div className="border-b bg-white border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-900 text-white rounded-full p-2">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Interpreter Management</h1>
                <p className="text-sm text-gray-500">Manage interpreter profiles and availability</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* reserved for future */}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <InterpreterColorManager />
      </div>
    </div>
  )
}
