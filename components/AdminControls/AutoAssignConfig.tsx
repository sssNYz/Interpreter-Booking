"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { toast } from "sonner";
import { SaveIcon, TestTubeIcon, AlertTriangleIcon, CheckCircleIcon } from "lucide-react";
import ModeSelector from "./ModeSelector";
import ParameterInput from "./ParameterInput";

import type { AssignmentPolicy, MeetingTypePriority } from "@/types/assignment";

interface ConfigData {
  policy: AssignmentPolicy;
  priorities: MeetingTypePriority[];
}

export default function AutoAssignConfig() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [localConfig, setLocalConfig] = useState<ConfigData | null>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Use ref to track validation state without causing re-renders
  const isValidatingRef = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Apply mode defaults to UI when switching away from CUSTOM so users see locked values reflected
  const applyModeDefaultsUI = (mode: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM') => {
    if (!localConfig) return;
    if (mode === 'CUSTOM') return; // keep user custom values
    let updates: Partial<AssignmentPolicy> = {};
    if (mode === 'BALANCE') {
      updates = { fairnessWindowDays: 60, maxGapHours: 2, w_fair: 2.0, w_urgency: 0.6, w_lrs: 0.6, drConsecutivePenalty: -0.8 };
    } else if (mode === 'URGENT') {
      updates = { fairnessWindowDays: 14, maxGapHours: 10, w_fair: 0.5, w_urgency: 2.5, w_lrs: 0.2, drConsecutivePenalty: -0.1 };
    } else {
      updates = { fairnessWindowDays: 30, maxGapHours: 5, w_fair: 1.2, w_urgency: 0.8, w_lrs: 0.3, drConsecutivePenalty: -0.5 };
    }
    setLocalConfig({ ...localConfig, policy: { ...localConfig.policy, ...updates, mode } });
    setHasUnsavedChanges(true);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    // Check for unsaved changes
    if (config && localConfig) {
      const hasChanges = JSON.stringify(config) !== JSON.stringify(localConfig);
      setHasUnsavedChanges(hasChanges);
    }
  }, [config, localConfig]);

  // Separate validation function that doesn't depend on anything
  const runValidation = async (configToValidate: ConfigData) => {
    // Skip validation if already validating
    if (isValidatingRef.current) {
      console.log("⚠️ Validation already in progress, skipping");
      return;
    }

    try {
      isValidatingRef.current = true;
      setValidating(true);
      console.log("🔍 Running validation...");
      
      const response = await fetch("/api/admin/config/auto-assign/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configToValidate)
      });

      const result = await response.json();
      setValidationResults(result);
      console.log("✅ Validation complete:", result.validation?.overallValid ? 'VALID' : 'INVALID');
    } catch (error) {
      console.error("❌ Validation error:", error);
    } finally {
      isValidatingRef.current = false;
      setValidating(false);
    }
  };

  // Manual validation function for immediate validation (e.g., before save)
  const validateNow = () => {
    if (localConfig) {
      // Clear any pending validation
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      runValidation(localConfig);
    }
  };

  useEffect(() => {
    // Clear any existing timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    // Debounced validation - only validate after user stops typing for 1000ms
    if (localConfig) {
      console.log("⏱️ Scheduling validation in 1000ms...");
      validationTimeoutRef.current = setTimeout(() => {
        runValidation(localConfig);
      }, 1000); // Increased to 1 second for better debouncing
    }

    // Cleanup function
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [localConfig]); // Only depend on localConfig, not the validation function

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/config/auto-assign");
      const result = await response.json();

      if (result.success) {
        setConfig(result.data);
        setLocalConfig(result.data);
        setHasUnsavedChanges(false);
      } else {
        toast.error("Failed to load configuration");
      }
    } catch (error) {
      console.error("Error loading config:", error);
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!localConfig || !config) {
      toast.error("No configuration to save");
      return;
    }

    if (saving) {
      console.log("⚠️ Save already in progress, ignoring duplicate call");
      return;
    }

    // Detect what has actually changed
    const policyChanged = JSON.stringify(config.policy) !== JSON.stringify(localConfig.policy);
    const prioritiesChanged = JSON.stringify(config.priorities) !== JSON.stringify(localConfig.priorities);
    
    if (!policyChanged && !prioritiesChanged) {
      console.log("ℹ️ No changes detected, skipping save");
      toast.info("No changes to save");
      return;
    }

    console.log("🚀 Attempting to save config changes:");
    console.log(`   📋 Policy changed: ${policyChanged}`);
    console.log(`   🎯 Priorities changed: ${prioritiesChanged}`);
    
    // Only send changed data
    const payload: any = {};
    if (policyChanged) {
      payload.policy = localConfig.policy;
      console.log("   📋 Including policy changes");
    }
    if (prioritiesChanged) {
      payload.priorities = localConfig.priorities;
      console.log("   🎯 Including priority changes");
    }

    try {
      setSaving(true);

      // Log the request payload
      console.log("📤 Sending request to /api/admin/config/auto-assign");
      console.log("📦 Optimized payload:", JSON.stringify(payload, null, 2));

      const response = await fetch("/api/admin/config/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log("📥 Response status:", response.status);
      const result = await response.json();
      console.log("📥 Response data:", result);

      if (result.success) {
        setConfig(result.data);
        setLocalConfig(result.data);
        setHasUnsavedChanges(false);
        
        // Show what was saved
        const changesSummary = result.changesSummary;
        let successMessage = "Configuration saved successfully";
        if (changesSummary) {
          const changes = [];
          if (changesSummary.policyUpdated) changes.push("policy");
          if (changesSummary.prioritiesUpdated) changes.push("priorities");
          if (changes.length > 0) {
            successMessage += ` (${changes.join(', ')})`;
          }
        }
        
        toast.success(successMessage);
        console.log("✅ Configuration saved successfully");
        
        if (result.changesSummary) {
          console.log("📊 Changes summary:", result.changesSummary);
        }
      } else {
        console.error("❌ Save failed:", result);
        toast.error(result.error || "Failed to save configuration");

        // Show detailed error information
        if (result.validation) {
          console.log("🔍 Validation details:", result.validation);
        }
      }
    } catch (error) {
      console.error("❌ Error saving config:", error);
      toast.error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    if (config) {
      setLocalConfig(config);
      setHasUnsavedChanges(false);
      toast.success("Configuration reset to last saved state");
    }
  };

  const updatePolicy = (updates: Partial<AssignmentPolicy>) => {
    if (!localConfig) return;
    setLocalConfig({
      ...localConfig,
      policy: { ...localConfig.policy, ...updates }
    });
    setHasUnsavedChanges(true);
  };

  const handleModeChange = (mode: AssignmentPolicy['mode']) => {
    if (mode === 'CUSTOM') {
      updatePolicy({ mode });
    } else {
      applyModeDefaultsUI(mode);
    }
  };

  const updatePriority = (meetingType: string, updates: Partial<MeetingTypePriority>) => {
    if (!localConfig) return;
    setLocalConfig({
      ...localConfig,
      priorities: localConfig.priorities.map(p =>
        p.meetingType === meetingType ? { ...p, ...updates } : p
      )
    });
    setHasUnsavedChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading configuration...</div>
      </div>
    );
  }

  if (!localConfig) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-red-600">Failed to load configuration</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auto-Assignment Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Configure interpreter assignment behavior and policies
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Unsaved Changes
            </Badge>
          )}
          <Button
            onClick={() => window.open('/AdminPage/mode-test', '_blank')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TestTubeIcon className="h-4 w-4" />
            Test Modes
          </Button>
          <Button
            onClick={async () => {
              try {
                const response = await fetch("/api/admin/config/debug");
                const result = await response.json();
                console.log("🔍 Debug info:", result);
                toast.success("Debug info logged to console");
              } catch (error) {
                console.error("Debug error:", error);
                toast.error("Debug failed");
              }
            }}
            variant="outline"
            className="flex items-center gap-2"
          >
            🔍 Debug
          </Button>
          <Button
            onClick={validateNow}
            variant="outline"
            className="flex items-center gap-2"
          >
            ✅ Validate Now
          </Button>
          {hasUnsavedChanges && (
            <Button onClick={resetConfig} variant="outline">
              Reset
            </Button>
          )}
          <Button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <SaveIcon className="h-4 w-4" />
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* Real-time Validation Status */}
      {validationResults && (
        <div className="space-y-2">
          {validationResults.errors?.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Configuration Errors:</p>
                  <ul className="text-sm space-y-1">
                    {validationResults.errors.map((error: string, index: number) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validationResults.warnings?.length > 0 && (
            <Alert variant="default">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Configuration Warnings:</p>
                  <ul className="text-sm space-y-1">
                    {validationResults.warnings.map((warning: string, index: number) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validationResults.isValid && validationResults.warnings?.length === 0 && (
            <Alert variant="default" className="border-green-200 bg-green-50">
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Configuration is valid and ready to save
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Master Toggle */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="autoAssignEnabled" className="text-base font-medium">
                Auto-Assignment System
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable automatic interpreter assignment
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="autoAssignEnabled"
                checked={localConfig.policy.autoAssignEnabled}
                onCheckedChange={(checked) => updatePolicy({ autoAssignEnabled: checked })}
              />
              <Badge variant={localConfig.policy.autoAssignEnabled ? "default" : "secondary"}>
                {localConfig.policy.autoAssignEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode Selection */}
      <ModeSelector
        policy={localConfig.policy}
        onModeChange={handleModeChange}
        onPolicyUpdate={updatePolicy}
      />

      <Separator />

      {/* Parameter Configuration */}
      <ParameterInput
        policy={localConfig.policy}
        onPolicyUpdate={updatePolicy}
      />

      <Separator />

      {/* Meeting Type Priorities */}
      <Card>
        <CardHeader>
          <CardTitle>Meeting Type Priorities</CardTitle>
          <CardDescription>Configure priority values and thresholds for each meeting type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Debug info */}
            {localConfig.priorities.length === 0 && (
              <div className="text-center p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 mb-2">No meeting type priorities found in database</p>
                <p className="text-sm text-gray-400 mb-4">
                  Meeting type priorities are required for the auto-assignment system to work properly.
                </p>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        // Call API to initialize priorities in database
                        const response = await fetch("/api/admin/config/auto-assign/init-priorities", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" }
                        });

                        const result = await response.json();

                        if (result.success) {
                          // Reload configuration to get the new priorities
                          await loadConfig();
                          toast.success("Default priorities created in database");
                        } else {
                          throw new Error(result.error || "Failed to create priorities");
                        }
                      } catch (error) {
                        console.error("Error creating priorities:", error);
                        toast.error("Failed to create default priorities");
                      }
                    }}
                  >
                    Initialize Default Priorities
                  </Button>
                  <p className="text-xs text-gray-400">
                    This will create default priorities in the database for DR, VIP, Weekly, General, Augent, and Other meeting types.
                  </p>
                </div>
              </div>
            )}

            {/* Show priorities count for debugging */}
            <div className="text-sm text-gray-500">
              Found {localConfig.priorities.length} meeting type priorities
            </div>

            {/* Debug: Show raw priorities data */}
            <details className="text-xs text-gray-400">
              <summary>Debug: Raw priorities data</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(localConfig.priorities, null, 2)}
              </pre>
            </details>

            {/* Debug: Show validation results */}
            <details className="text-xs text-gray-400">
              <summary>Debug: Validation results</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(validationResults, null, 2)}
              </pre>
            </details>

            {/* Debug: Show save button state */}
            <div className="text-xs text-gray-400 p-2 bg-gray-50 rounded">
              <p><strong>Save Button Debug:</strong></p>
              <p>• Saving: {saving ? 'true' : 'false'}</p>
              <p>• Has validation results: {validationResults ? 'true' : 'false'}</p>
              <p>• Validation is valid: {validationResults?.isValid ? 'true' : 'false'}</p>
              <p>• Button disabled: {(saving || (validationResults && !validationResults.isValid)) ? 'true' : 'false'}</p>
              <p>• Has unsaved changes: {hasUnsavedChanges ? 'true' : 'false'}</p>
            </div>

            {localConfig.priorities.map((priority) => (
              <div key={priority.meetingType} className="grid grid-cols-4 gap-4 p-4 border rounded-lg">
                <div>
                  <Label htmlFor={`name-${priority.meetingType}`}>Meeting Type Name</Label>
                  <Input
                    id={`name-${priority.meetingType}`}
                    type="text"
                    value={priority.meetingType}
                    onChange={(e) => updatePriority(priority.meetingType, { meetingType: e.target.value })}
                    disabled={localConfig.policy.mode !== 'CUSTOM'}
                    className={localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}
                  />
                </div>
                <div>
                  <Label htmlFor={`priority-${priority.meetingType}`}>Priority Value</Label>
                  <Input
                    id={`priority-${priority.meetingType}`}
                    type="number"
                    min="1"
                    max="10"
                    value={priority.priorityValue || 1}
                    onChange={(e) => updatePriority(priority.meetingType, { priorityValue: parseInt(e.target.value) || 1 })}
                    disabled={false}
                    className={''}
                  />
                </div>
                <div>
                  <Label htmlFor={`urgent-${priority.meetingType}`}>Urgent Threshold (days)</Label>
                  <Input
                    id={`urgent-${priority.meetingType}`}
                    type="number"
                    min="0"
                    max="30"
                    value={priority.urgentThresholdDays || 0}
                    onChange={(e) => updatePriority(priority.meetingType, { urgentThresholdDays: parseInt(e.target.value) || 0 })}
                    disabled={localConfig.policy.mode !== 'CUSTOM'}
                    className={localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}
                  />
                </div>
                <div>
                  <Label htmlFor={`general-${priority.meetingType}`}>General Threshold (days)</Label>
                  <Input
                    id={`general-${priority.meetingType}`}
                    type="number"
                    min="1"
                    max="90"
                    value={priority.generalThresholdDays || 1}
                    onChange={(e) => updatePriority(priority.meetingType, { generalThresholdDays: parseInt(e.target.value) || 1 })}
                    disabled={localConfig.policy.mode !== 'CUSTOM'}
                    className={localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
