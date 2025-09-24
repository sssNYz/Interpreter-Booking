"use client"

import React, { useEffect, useState } from "react";
import { Settings, Building2, Users, Languages } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import existing components
import EnvironmentManagement from "./environment-section";
import InterpreterManagement from "./interpreter-section";
import LanguageManagement from "./language-section";

export default function UnifiedManagementPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("environments");

  useEffect(() => {
    let alive = true;
    fetch('/api/user/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!alive) return;
        const roles: string[] = d?.user?.roles || [];
        setAllowed(roles.includes('ADMIN') || roles.includes('SUPER_ADMIN'));
      }).catch(() => setAllowed(false));
    return () => { alive = false };
  }, []);

  if (allowed === null) return null;
  if (!allowed) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      Access denied. Admin rights needed.
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f7f7] font-sans text-gray-900">
      {/* Header */}
      <div className="border-b bg-white border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-900 text-white rounded-full p-2">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">System Management</h1>
                <p className="text-sm text-gray-500">Manage environments, interpreters, and languages</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Navigation */}
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid grid-cols-3 w-auto">
              <TabsTrigger 
                value="environments" 
                className="flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Environments
              </TabsTrigger>
              <TabsTrigger 
                value="interpreters" 
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Interpreters
              </TabsTrigger>
              <TabsTrigger 
                value="languages" 
                className="flex items-center gap-2"
              >
                <Languages className="h-4 w-4" />
                Languages
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <TabsContent value="environments">
            <EnvironmentManagement />
          </TabsContent>

          <TabsContent value="interpreters">
            <InterpreterManagement />
          </TabsContent>

          <TabsContent value="languages">
            <LanguageManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
