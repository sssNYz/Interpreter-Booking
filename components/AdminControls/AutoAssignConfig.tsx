"use client";

import { useState, useEffect } from "react";
import type { AssignmentPolicy } from "@/types/assignment";

interface AutoAssignConfigProps {
  className?: string;
}

export default function AutoAssignConfig({ className = "" }: AutoAssignConfigProps) {
  const [config, setConfig] = useState<AssignmentPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/config/auto-assign");
      const data = await response.json();
      
      if (data.success) {
        setConfig(data.data);
      } else {
        setMessage({ type: "error", text: "Failed to load configuration" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error loading configuration" });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    
    try {
      setSaving(true);
      const response = await fetch("/api/admin/config/auto-assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: "success", text: "Configuration saved successfully" });
        setConfig(data.data);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save configuration" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error saving configuration" });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (field: keyof AssignmentPolicy, value: string | number | boolean) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow ${className}`}>
        <p className="text-red-600">Failed to load configuration</p>
      </div>
    );
  }

  return (
    <div className={`p-6 bg-white rounded-lg shadow ${className}`}>
      <h2 className="text-xl font-semibold mb-6">Auto-Assignment Configuration</h2>
      
      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Kill Switch */}
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Auto-Assignment Enabled
            </label>
            <p className="text-sm text-gray-500">
              Master switch to enable/disable the entire auto-assignment system
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={config.autoAssignEnabled}
              onChange={(e) => updateConfig("autoAssignEnabled", e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Fairness Window */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fairness Window (Days)
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Rolling window for calculating interpreter hours (7-90 days)
          </p>
          <input
            type="range"
            min="7"
            max="90"
            value={config.fairnessWindowDays}
            onChange={(e) => updateConfig("fairnessWindowDays", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>7 days</span>
            <span className="font-medium">{config.fairnessWindowDays} days</span>
            <span>90 days</span>
          </div>
        </div>

        {/* Max Gap Hours */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Maximum Gap Hours
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Maximum allowed difference in hours between interpreters (1-100 hours)
          </p>
          <input
            type="range"
            min="1"
            max="100"
            value={config.maxGapHours}
            onChange={(e) => updateConfig("maxGapHours", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 hour</span>
            <span className="font-medium">{config.maxGapHours} hours</span>
            <span>100 hours</span>
          </div>
        </div>

        {/* Min Advance Days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Advance Days
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Days before booking when urgency scoring kicks in (0-30 days)
          </p>
          <input
            type="range"
            min="0"
            max="30"
            value={config.minAdvanceDays}
            onChange={(e) => updateConfig("minAdvanceDays", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0 days</span>
            <span className="font-medium">{config.minAdvanceDays} days</span>
            <span>30 days</span>
          </div>
        </div>

        {/* Weights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fairness Weight
            </label>
            <p className="text-sm text-gray-500 mb-2">Importance of hour balance (0-5)</p>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={config.w_fair}
              onChange={(e) => updateConfig("w_fair", parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center text-sm font-medium mt-1">{config.w_fair}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Urgency Weight
            </label>
            <p className="text-sm text-gray-500 mb-2">Importance of deadline proximity (0-5)</p>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={config.w_urgency}
              onChange={(e) => updateConfig("w_urgency", parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center text-sm font-medium mt-1">{config.w_urgency}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LRS Weight
            </label>
            <p className="text-sm text-gray-500 mb-2">Importance of least-recently-served (0-5)</p>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={config.w_lrs}
              onChange={(e) => updateConfig("w_lrs", parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center text-sm font-medium mt-1">{config.w_lrs}</div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
