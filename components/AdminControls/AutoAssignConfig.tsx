"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";
import { SaveIcon, TestTubeIcon, AlertTriangleIcon, CheckCircleIcon } from "lucide-react";
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
  const [, setValidating] = useState(false);
  const [localConfig, setLocalConfig] = useState<ConfigData | null>(null);
  const [validationResults, setValidationResults] = useState<{
    isValid?: boolean;
    errors?: string[];
    warnings?: string[];
    validation?: {
      overallValid?: boolean;
      errors?: string[];
      warnings?: string[];
    };
  } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Use ref to track validation state without causing re-renders
  const isValidatingRef = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Apply mode defaults to UI when switching away from CUSTOM so users see locked values reflected
  const applyModeDefaultsUI = (
    mode: "BALANCE" | "URGENT" | "NORMAL" | "CUSTOM"
  ) => {
    if (!localConfig) return;
    if (mode === "CUSTOM") return; // keep user custom values
    let updates: Partial<AssignmentPolicy> = {};
    if (mode === "BALANCE") {
      updates = {
        fairnessWindowDays: 60,
        maxGapHours: 2,
        w_fair: 2.0,
        w_urgency: 0.6,
        w_lrs: 0.6,
        drConsecutivePenalty: -0.8,
      };
    } else if (mode === "URGENT") {
      updates = {
        fairnessWindowDays: 14,
        maxGapHours: 10,
        w_fair: 0.5,
        w_urgency: 2.5,
        w_lrs: 0.2,
        drConsecutivePenalty: -0.1,
      };
    } else {
      updates = {
        fairnessWindowDays: 30,
        maxGapHours: 5,
        w_fair: 1.2,
        w_urgency: 0.8,
        w_lrs: 0.3,
        drConsecutivePenalty: -0.5,
      };
    }
    setLocalConfig({
      ...localConfig,
      policy: { ...localConfig.policy, ...updates, mode },
    });
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
        body: JSON.stringify(configToValidate),
      });

      const result = await response.json();
      setValidationResults(result);
      console.log(
        "✅ Validation complete:",
        result.validation?.overallValid ? "VALID" : "INVALID"
      );
    } catch (error) {
      console.error("❌ Validation error:", error);
    } finally {
      isValidatingRef.current = false;
      setValidating(false);
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

    // Check for validation errors before saving
    const hasValidationErrors = localConfig.priorities.some(priority => {
      const urgentValid = (priority.urgentThresholdDays || 0) >= 0 && (priority.urgentThresholdDays || 0) <= 365;
      const generalValid = (priority.generalThresholdDays || 1) >= 1 && (priority.generalThresholdDays || 1) <= 1000;
      const priorityValid = (priority.priorityValue || 1) >= 1 && (priority.priorityValue || 1) <= 10;
      return !urgentValid || !generalValid || !priorityValid;
    });

    if (hasValidationErrors) {
      toast.error("⚠️ Please fix validation errors before saving");
      return;
    }

    // Detect what has actually changed
    const policyChanged =
      JSON.stringify(config.policy) !== JSON.stringify(localConfig.policy);
    const prioritiesChanged =
      JSON.stringify(config.priorities) !==
      JSON.stringify(localConfig.priorities);

    if (!policyChanged && !prioritiesChanged) {
      console.log("ℹ️ No changes detected, skipping save");
      toast.info("No changes to save");
      return;
    }

    console.log("🚀 Attempting to save config changes:");
    console.log(`   📋 Policy changed: ${policyChanged}`);
    console.log(`   🎯 Priorities changed: ${prioritiesChanged}`);

    // Only send changed data
    const payload: {
      policy?: AssignmentPolicy;
      priorities?: MeetingTypePriority[];
    } = {};
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
        body: JSON.stringify(payload),
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
            successMessage += ` (${changes.join(", ")})`;
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
      toast.error(
        `Failed to save configuration: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
      policy: { ...localConfig.policy, ...updates },
    });
    setHasUnsavedChanges(true);
  };

  const handleModeChange = (mode: AssignmentPolicy["mode"]) => {
    if (mode === "CUSTOM") {
      updatePolicy({ mode });
    } else {
      applyModeDefaultsUI(mode);
    }
  };

  const updatePriority = (
    meetingType: string,
    updates: Partial<MeetingTypePriority>
  ) => {
    if (!localConfig) return;
    setLocalConfig({
      ...localConfig,
      priorities: localConfig.priorities.map((p) =>
        p.meetingType === meetingType ? { ...p, ...updates } : p
      ),
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
            <Badge
              variant="outline"
              className="text-orange-600 border-orange-200"
            >
              Unsaved Changes
            </Badge>
          )}
          <Button
            onClick={() => window.open("/AdminPage/mode-test", "_blank")}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TestTubeIcon className="h-4 w-4" />
            Test Modes
          </Button>
          {hasUnsavedChanges && (
            <Button onClick={resetConfig} variant="outline">
              Reset
            </Button>
          )}
          <Button
            onClick={saveConfig}
            disabled={saving || (localConfig && localConfig.priorities.some(priority => {
              const urgentValid = (priority.urgentThresholdDays || 0) >= 0 && (priority.urgentThresholdDays || 0) <= 365;
              const generalValid = (priority.generalThresholdDays || 1) >= 1 && (priority.generalThresholdDays || 1) <= 1000;
              const priorityValid = (priority.priorityValue || 1) >= 1 && (priority.priorityValue || 1) <= 10;
              return !urgentValid || !generalValid || !priorityValid;
            }))}
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
          {validationResults.errors && validationResults.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Configuration Errors:</p>
                  <ul className="text-sm space-y-1">
                    {validationResults.errors?.map((error: string, index: number) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validationResults.warnings && validationResults.warnings.length > 0 && (
            <Alert variant="default">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Configuration Warnings:</p>
                  <ul className="text-sm space-y-1">
                    {validationResults.warnings?.map((warning: string, index: number) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validationResults.isValid &&
            validationResults.warnings?.length === 0 && (
              <Alert variant="default" className="border-green-200 bg-green-50">
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Configuration is valid and ready to save
                </AlertDescription>
              </Alert>
            )}
        </div>
      )}

      {/* Auto Assign System & Mode Selection - Same Height Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Auto Assign System Toggle - 25% */}
        <div className="lg:col-span-1">
          <Card className="h-64 shadow-md">
            <CardContent className="pt-6 h-full flex flex-col">
              <div className="space-y-4 flex-1">
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
        </div>

        {/* Mode Selection - 75% with 3 horizontal zones */}
        <div className="lg:col-span-3">
          <Card className="h-64 shadow-md">
            <CardContent className="pt-6 h-full">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full">
                {/* Zone 1: Mode Selector - 20% */}
                <div className="lg:col-span-1 flex flex-col">
                  <Label className="text-sm font-medium mb-3">Assignment Mode</Label>
                  <div className="flex-1">
                    <Select
                      value={localConfig.policy.mode}
                      onValueChange={handleModeChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BALANCE">Balance Mode</SelectItem>
                        <SelectItem value="URGENT">Urgent Mode</SelectItem>
                        <SelectItem value="NORMAL">Normal Mode</SelectItem>
                        <SelectItem value="CUSTOM">Custom Mode</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Zone 2: Mode Characteristics - 40% */}
                <div className="lg:col-span-2 flex flex-col">
                  <Label className="text-sm font-medium mb-3">Mode Focus</Label>
                  <div className="flex-1 text-xs space-y-1">
                    {localConfig.policy.mode === 'BALANCE' && (
                      <ul className="space-y-1">
                        <li>• <strong>Focus:</strong> Equal workload distribution</li>
                        <li>• <strong>Good for:</strong> Long-term fairness, team morale</li>
                        <li>• <strong>Bad for:</strong> Urgent assignments, crisis situations</li>
                        <li>• <strong>Key feature:</strong> High fairness weighting (2.0x)</li>
                        <li>• <strong>Best when:</strong> You have time to plan assignments</li>
                      </ul>
                    )}
                    {localConfig.policy.mode === 'URGENT' && (
                      <ul className="space-y-1">
                        <li>• <strong>Focus:</strong> Immediate assignment processing</li>
                        <li>• <strong>Good for:</strong> Crisis situations, time-critical bookings</li>
                        <li>• <strong>Bad for:</strong> Fairness, long-term workload balance</li>
                        <li>• <strong>Key feature:</strong> High urgency weighting (2.5x)</li>
                        <li>• <strong>Best when:</strong> Emergency response needed</li>
                      </ul>
                    )}
                    {localConfig.policy.mode === 'NORMAL' && (
                      <ul className="space-y-1">
                        <li>• <strong>Focus:</strong> Balanced approach</li>
                        <li>• <strong>Good for:</strong> Standard operations, daily workflow</li>
                        <li>• <strong>Bad for:</strong> Extreme situations (crisis or perfect fairness)</li>
                        <li>• <strong>Key feature:</strong> Balanced weighting (1.2x fairness)</li>
                        <li>• <strong>Best when:</strong> Regular business operations</li>
                      </ul>
                    )}
                    {localConfig.policy.mode === 'CUSTOM' && (
                      <ul className="space-y-1">
                        <li>• <strong>Focus:</strong> Full control over all parameters</li>
                        <li>• <strong>Good for:</strong> Expert users, specific requirements</li>
                        <li>• <strong>Bad for:</strong> Beginners, standard operations</li>
                        <li>• <strong>Key feature:</strong> All parameters configurable</li>
                        <li>• <strong>Best when:</strong> You need precise control</li>
                      </ul>
                    )}
                  </div>
                </div>

                {/* Zone 3: Meeting Type Configuration - 40% */}
                <div className="lg:col-span-2 flex flex-col">
                  <Label className="text-sm font-medium mb-3">Assignment Timing</Label>
                  <div className="flex-1 text-xs space-y-1">
                    {localConfig.priorities.map((priority) => {
                      // Get the correct urgent threshold based on current mode
                      const getModeThresholds = (meetingType: string, mode: string) => {
                        const thresholds = {
                          BALANCE: {
                            DR: 7, VIP: 7, Augent: 7, Weekly: 3, General: 7, Other: 3,
                          },
                          NORMAL: {
                            DR: 10, VIP: 7, Augent: 10, Weekly: 7, General: 10, Other: 7,
                          },
                          URGENT: {
                            DR: 14, VIP: 7, Augent: 14, Weekly: 14, General: 14, Other: 7,
                          },
                          CUSTOM: {
                            DR: 1, VIP: 2, Augent: 3, Weekly: 3, General: 3, Other: 5,
                          },
                        };
                        return thresholds[mode as keyof typeof thresholds]?.[meetingType as keyof typeof thresholds.BALANCE] || thresholds.BALANCE.Other;
                      };

                      const urgentDays = localConfig.policy.mode === 'CUSTOM' ? (priority.urgentThresholdDays || 0) : getModeThresholds(priority.meetingType, localConfig.policy.mode);

                      return (
                        <div key={priority.meetingType} className="flex justify-between items-center">
                          <span className="font-medium">{priority.meetingType}</span>
                          <span className="font-bold text-blue-600">{urgentDays} days before</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Show message when not in CUSTOM mode */}
      {localConfig.policy.mode !== 'CUSTOM' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">🔒 Advanced Settings Hidden</p>
              <p className="text-sm">
                Switch to <strong>CUSTOM</strong> mode to configure fairness parameters, score weights, and meeting type priorities.
              </p>
              <p className="text-xs mt-2">
                Current mode uses pre-configured settings optimized for {localConfig.policy.mode.toLowerCase()} scenarios.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Only show advanced settings when in CUSTOM mode */}
      {localConfig.policy.mode === 'CUSTOM' && (
        <>
          <Separator />

          {/* Parameter Configuration - Meeting Type Priorities Left, Fairness + Scoring Right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Meeting Type Priorities */}
            <Card className="flex flex-col">
              <CardHeader className="flex-shrink-0 py-2 px-3">
                <CardTitle className="text-sm font-medium">Meeting Type Priorities</CardTitle>
                <CardDescription className="text-xs">Priority values and thresholds</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-3 overflow-y-auto">
                {localConfig.priorities.length === 0 ? (
                  <div className="text-center p-4 border-2 border-dashed border-gray-300 rounded">
                    <p className="text-gray-500 mb-2 text-xs">No priorities found</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch("/api/admin/config/auto-assign/init-priorities", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" }
                          });
                          const result = await response.json();
                          if (result.success) {
                            await loadConfig();
                            toast.success("Default priorities created");
                          } else {
                            throw new Error(result.error || "Failed to create priorities");
                          }
                        } catch (error) {
                          console.error("Error creating priorities:", error);
                          toast.error("Failed to create default priorities");
                        }
                      }}
                    >
                      Initialize
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {localConfig.priorities.map((priority, index) => (
                      <div key={priority.meetingType} className="border border-gray-200 rounded p-2 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-800">{priority.meetingType}</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs text-gray-600">Priority</Label>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              value={priority.priorityValue || 1}
                              onChange={(e) => updatePriority(priority.meetingType, { priorityValue: parseInt(e.target.value) || 1 })}
                              className={`h-7 text-xs ${
                                (priority.priorityValue || 1) < 1 || (priority.priorityValue || 1) > 10 
                                  ? 'border-red-500 bg-red-50' 
                                  : ''
                              }`}
                            />
                            {(priority.priorityValue || 1) < 1 && (
                              <p className="text-xs text-red-500 mt-1">⚠️ Priority must be 1-10</p>
                            )}
                            {(priority.priorityValue || 1) > 10 && (
                              <p className="text-xs text-red-500 mt-1">⚠️ Priority must be 1-10</p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Urgent</Label>
                            <Input
                              type="number"
                              min="0"
                              max="365"
                              value={priority.urgentThresholdDays || 0}
                              onChange={(e) => updatePriority(priority.meetingType, { urgentThresholdDays: parseInt(e.target.value) || 0 })}
                              className={`h-7 text-xs ${
                                (priority.urgentThresholdDays || 0) < 0 || (priority.urgentThresholdDays || 0) > 365 
                                  ? 'border-red-500 bg-red-50' 
                                  : ''
                              }`}
                            />
                            {(priority.urgentThresholdDays || 0) < 0 && (
                              <p className="text-xs text-red-500 mt-1">⚠️ Urgent must be 0-365 days</p>
                            )}
                            {(priority.urgentThresholdDays || 0) > 365 && (
                              <p className="text-xs text-red-500 mt-1">⚠️ Urgent must be 0-365 days</p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">General</Label>
                            <Input
                              type="number"
                              min="1"
                              max="1000"
                              value={priority.generalThresholdDays || 1}
                              onChange={(e) => updatePriority(priority.meetingType, { generalThresholdDays: parseInt(e.target.value) || 1 })}
                              className={`h-7 text-xs ${
                                (priority.generalThresholdDays || 1) < 1 || (priority.generalThresholdDays || 1) > 1000 
                                  ? 'border-red-500 bg-red-50' 
                                  : ''
                              }`}
                            />
                            {(priority.generalThresholdDays || 1) < 1 && (
                              <p className="text-xs text-red-500 mt-1">⚠️ General must be 1-1000 days</p>
                            )}
                            {(priority.generalThresholdDays || 1) > 1000 && (
                              <p className="text-xs text-red-500 mt-1">⚠️ General must be 1-1000 days</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column: Fairness + Scoring Settings */}
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex-1">
                <ParameterInput
                  policy={localConfig.policy}
                  onPolicyUpdate={updatePolicy}
                  showFairnessOnly={true}
                />
              </div>
              <div className="flex-1">
                <ParameterInput
                  policy={localConfig.policy}
                  onPolicyUpdate={updatePolicy}
                  showScoringOnly={true}
                />
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}