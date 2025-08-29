"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import type { AssignmentPolicy, MeetingTypePriority } from "@/types/assignment";

interface ConfigData {
  policy: AssignmentPolicy;
  priorities: MeetingTypePriority[];
}

export default function AutoAssignConfig() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<ConfigData | null>(null);

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
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/config/auto-assign");
      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data);
        setLocalConfig(result.data);
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
    if (!localConfig) return;
    
    try {
      setSaving(true);
      const response = await fetch("/api/admin/config/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localConfig)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data);
        setLocalConfig(result.data);
        toast.success("Configuration saved successfully");
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const updatePolicy = (updates: Partial<AssignmentPolicy>) => {
    if (!localConfig) return;
    setLocalConfig({
      ...localConfig,
      policy: { ...localConfig.policy, ...updates }
    });
  };

  const updatePriority = (meetingType: string, updates: Partial<MeetingTypePriority>) => {
    if (!localConfig) return;
    setLocalConfig({
      ...localConfig,
      priorities: localConfig.priorities.map(p => 
        p.meetingType === meetingType ? { ...p, ...updates } : p
      )
    });
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Auto-Assignment Configuration</h1>
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>System Control</CardTitle>
          <CardDescription>Master switch to enable/disable auto-assignment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch
              id="autoAssignEnabled"
              checked={localConfig.policy.autoAssignEnabled}
              onCheckedChange={(checked) => updatePolicy({ autoAssignEnabled: checked })}
            />
            <Label htmlFor="autoAssignEnabled">
              {localConfig.policy.autoAssignEnabled ? "Enabled" : "Disabled"}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment Mode</CardTitle>
          <CardDescription>Choose the assignment strategy for interpreters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mode">Assignment Mode</Label>
              <Select
                value={localConfig.policy.mode}
                onValueChange={(value) => {
                  const m = value as 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM';
                  if (m !== 'CUSTOM') {
                    applyModeDefaultsUI(m);
                  } else {
                    updatePolicy({ mode: m });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BALANCE">Balance Mode - Prioritize workload fairness</SelectItem>
                  <SelectItem value="URGENT">Urgent Mode - Prioritize time-critical assignments</SelectItem>
                  <SelectItem value="NORMAL">Normal Mode - Balanced approach</SelectItem>
                  <SelectItem value="CUSTOM">Custom Mode - Manually configure all settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <strong>Balance Mode:</strong> Fairness (2.0x), Urgency (0.6x), LRS (0.6x)<br/>
              <strong>Urgent Mode:</strong> Fairness (0.5x), Urgency (2.5x), LRS (0.2x)<br/>
              <strong>Normal Mode:</strong> Fairness (1.2x), Urgency (0.8x), LRS (0.3x)
            </div>
          </div>
        </CardContent>
      </Card>

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
                <p className="text-gray-500 mb-2">No meeting type priorities found</p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      // Create default priorities
                      const defaultPriorities = [
                        { meetingType: 'DR', priorityValue: 5, urgentThresholdDays: 1, generalThresholdDays: 7 },
                        { meetingType: 'VIP', priorityValue: 4, urgentThresholdDays: 2, generalThresholdDays: 14 },
                        { meetingType: 'Weekly', priorityValue: 3, urgentThresholdDays: 3, generalThresholdDays: 30 },
                        { meetingType: 'General', priorityValue: 2, urgentThresholdDays: 3, generalThresholdDays: 30 },
                        { meetingType: 'Augent', priorityValue: 2, urgentThresholdDays: 3, generalThresholdDays: 30 },
                        { meetingType: 'Other', priorityValue: 1, urgentThresholdDays: 5, generalThresholdDays: 45 }
                      ];
                      
                      setLocalConfig({
                        ...localConfig,
                        priorities: defaultPriorities.map((p, index) => ({
                          ...p,
                          id: index + 1,
                          createdAt: new Date(),
                          updatedAt: new Date()
                        }))
                      });
                      
                      toast.success("Default priorities created");
                    } catch (error) {
                      toast.error("Failed to create default priorities");
                    }
                  }}
                >
                  Create Default Priorities
                </Button>
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
                    value={priority.priorityValue}
                    onChange={(e) => updatePriority(priority.meetingType, { priorityValue: parseInt(e.target.value) })}
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
                    value={priority.urgentThresholdDays}
                    onChange={(e) => updatePriority(priority.meetingType, { urgentThresholdDays: parseInt(e.target.value) })}
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
                    value={priority.generalThresholdDays}
                    onChange={(e) => updatePriority(priority.meetingType, { generalThresholdDays: parseInt(e.target.value) })}
                    disabled={localConfig.policy.mode !== 'CUSTOM'}
                    className={localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fairness Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Fairness Settings</CardTitle>
          <CardDescription>Configure workload balance and fairness parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium">Hour Balance Tolerance</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Maximum allowed difference in hours between interpreters
            </p>
            <div className="flex items-center space-x-4">
              <Slider
                value={[localConfig.policy.maxGapHours]}
                onValueChange={([value]) => updatePolicy({ maxGapHours: value })}
                max={100}
                min={1}
                step={1}
                className="flex-1"
                disabled={localConfig.policy.mode !== 'CUSTOM'}
              />
              <span className={`min-w-[3rem] text-center ${localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}`}>{localConfig.policy.maxGapHours}h</span>
            </div>
          </div>

          <div>
            <h4 className="font-medium">Fairness Window</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Number of days to look back when calculating workload balance
            </p>
            <div className="flex items-center space-x-4">
              <Slider
                value={[localConfig.policy.fairnessWindowDays]}
                onValueChange={([value]) => updatePolicy({ fairnessWindowDays: value })}
                max={90}
                min={7}
                step={1}
                className="flex-1"
                disabled={localConfig.policy.mode !== 'CUSTOM'}
              />
              <span className={`min-w-[3rem] text-center ${localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}`}>{localConfig.policy.fairnessWindowDays} days</span>
            </div>
          </div>

          <div>
            <h4 className="font-medium">Minimum Advance Days</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Days before a booking starts when urgency scoring begins
            </p>
            <div className="flex items-center space-x-4">
              <Slider
                value={[localConfig.policy.minAdvanceDays]}
                onValueChange={([value]) => updatePolicy({ minAdvanceDays: value })}
                max={30}
                min={0}
                step={1}
                className="flex-1"
                disabled={localConfig.policy.mode !== 'CUSTOM'}
              />
              <span className={`min-w-[3rem] text-center ${localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}`}>{localConfig.policy.minAdvanceDays} days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Weights */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring Weights</CardTitle>
          <CardDescription>Configure the importance of different factors in interpreter selection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium">Hour Balance Importance</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Higher values ensure more balanced workloads, while lower values allow other factors to dominate.
            </p>
            <div className="flex items-center space-x-4">
              <Slider
                value={[localConfig.policy.w_fair]}
                onValueChange={([value]) => updatePolicy({ w_fair: value })}
                max={5}
                min={0}
                step={0.1}
                className="flex-1"
                disabled={localConfig.policy.mode !== 'CUSTOM'}
              />
              <span className={`min-w-[3rem] text-center ${localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}`}>{localConfig.policy.w_fair.toFixed(1)}</span>
            </div>
          </div>

          <div>
            <h4 className="font-medium">Urgency Importance</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Higher values ensure urgent bookings get assigned quickly, even if it means less balanced hours.
            </p>
            <div className="flex items-center space-x-4">
              <Slider
                value={[localConfig.policy.w_urgency]}
                onValueChange={([value]) => updatePolicy({ w_urgency: value })}
                max={5}
                min={0}
                step={0.1}
                className="flex-1"
                disabled={localConfig.policy.mode !== 'CUSTOM'}
              />
              <span className={`min-w-[3rem] text-center ${localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}`}>{localConfig.policy.w_urgency.toFixed(1)}</span>
            </div>
          </div>

          <div>
            <h4 className="font-medium">Rotation Importance (LRS)</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Higher values ensure interpreters who haven&apos;t been assigned recently get priority.
            </p>
            <div className="flex items-center space-x-4">
              <Slider
                value={[localConfig.policy.w_lrs]}
                onValueChange={([value]) => updatePolicy({ w_lrs: value })}
                max={5}
                min={0}
                step={0.1}
                className="flex-1"
                disabled={localConfig.policy.mode !== 'CUSTOM'}
              />
              <span className={`min-w-[3rem] text-center ${localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}`}>{localConfig.policy.w_lrs.toFixed(1)}</span>
            </div>
          </div>

          <div>
            <h4 className="font-medium">DR Consecutive Penalty</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Penalty applied to interpreters with recent DR assignments to prevent burnout.
            </p>
            <div className="flex items-center space-x-4">
              <Slider
                value={[localConfig.policy.drConsecutivePenalty]}
                onValueChange={([value]) => updatePolicy({ drConsecutivePenalty: value })}
                max={0}
                min={-2}
                step={0.1}
                className="flex-1"
                disabled={localConfig.policy.mode !== 'CUSTOM'}
              />
              <span className={`min-w-[3rem] text-center ${localConfig.policy.mode !== 'CUSTOM' ? 'opacity-50' : ''}`}>{localConfig.policy.drConsecutivePenalty.toFixed(1)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
