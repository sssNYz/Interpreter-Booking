"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon, AlertTriangleIcon, CheckCircleIcon } from "lucide-react";
import type { AssignmentPolicy } from "@/types/assignment";

interface ModeSelectorProps {
  policy: AssignmentPolicy;
  onModeChange: (mode: AssignmentPolicy['mode']) => void;
  onPolicyUpdate: (updates: Partial<AssignmentPolicy>) => void;
}

interface ModeConfig {
  name: string;
  description: string;
  icon: string;
  badge: "success" | "warning" | "destructive" | "secondary";
  features: string[];
  warnings?: string[];
  defaults: Partial<AssignmentPolicy>;
}

const MODE_CONFIGS: Record<AssignmentPolicy['mode'], ModeConfig> = {
  BALANCE: {
    name: "Balance Mode",
    description: "Prioritizes workload fairness and equal distribution of assignments",
    icon: "⚖️",
    badge: "success",
    features: [
      "High fairness weighting (2.0x)",
      "Extended fairness window (60 days)",
      "Strict DR consecutive blocking",
      "Pool-based delayed assignments",
      "Optimal for long-term fairness"
    ],
    defaults: {
      fairnessWindowDays: 60,
      maxGapHours: 2,
      w_fair: 2.0,
      w_urgency: 0.6,
      w_lrs: 0.6,
      drConsecutivePenalty: -0.8
    }
  },
  URGENT: {
    name: "Urgent Mode",
    description: "Prioritizes immediate assignment for time-critical bookings",
    icon: "🚨",
    badge: "destructive",
    features: [
      "High urgency weighting (2.5x)",
      "Short fairness window (14 days)",
      "Minimal DR consecutive penalties",
      "Immediate assignment processing",
      "Optimal for crisis situations"
    ],
    warnings: [
      "May create workload imbalances",
      "Reduced fairness considerations"
    ],
    defaults: {
      fairnessWindowDays: 14,
      maxGapHours: 10,
      w_fair: 0.5,
      w_urgency: 2.5,
      w_lrs: 0.2,
      drConsecutivePenalty: -0.1
    }
  },
  NORMAL: {
    name: "Normal Mode",
    description: "Balanced approach between fairness and urgency",
    icon: "🎯",
    badge: "secondary",
    features: [
      "Balanced weighting (1.2x fairness)",
      "Standard fairness window (30 days)",
      "Moderate DR consecutive penalties",
      "Regular assignment processing",
      "Optimal for standard operations"
    ],
    defaults: {
      fairnessWindowDays: 30,
      maxGapHours: 5,
      w_fair: 1.2,
      w_urgency: 0.8,
      w_lrs: 0.3,
      drConsecutivePenalty: -0.5
    }
  },
  CUSTOM: {
    name: "Custom Mode",
    description: "Full control over all assignment parameters",
    icon: "🔧",
    badge: "warning",
    features: [
      "All parameters configurable",
      "Advanced fine-tuning available",
      "Real-time validation feedback",
      "Expert configuration mode"
    ],
    warnings: [
      "Requires expertise to configure properly",
      "Invalid settings may cause assignment issues"
    ],
    defaults: {} // No defaults for custom mode
  }
};

export default function ModeSelector({ policy, onModeChange, onPolicyUpdate }: ModeSelectorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const currentConfig = MODE_CONFIGS[policy.mode];

  const handleModeChange = (newMode: AssignmentPolicy['mode']) => {
    if (newMode === 'CUSTOM') {
      // Just change mode, keep current values
      onModeChange(newMode);
    } else {
      // Apply mode defaults
      const config = MODE_CONFIGS[newMode];
      onPolicyUpdate({ ...config.defaults, mode: newMode });
    }
  };

  const getParameterStatus = () => {
    if (policy.mode === 'CUSTOM') return null;
    
    const config = MODE_CONFIGS[policy.mode];
    const isMatching = (Object.keys(config.defaults) as Array<keyof AssignmentPolicy>).every((key) => {
      const expected = config.defaults[key];
      const current = policy[key];
      if (typeof expected === 'number' && typeof current === 'number') {
        return Math.abs(current - expected) < 0.01;
      }
      return current === expected;
    });
    
    return isMatching ? 'matching' : 'modified';
  };

  const parameterStatus = getParameterStatus();

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Assignment Mode
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Choose the assignment strategy that best fits your operational needs</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Configure how the system prioritizes assignments
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentConfig.icon}</span>
              <Badge variant={currentConfig.badge}>
                {currentConfig.name}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Select
              value={policy.mode}
              onValueChange={handleModeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignment mode" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODE_CONFIGS).map(([mode, config]) => (
                  <SelectItem key={mode} value={mode}>
                    <div className="flex items-center gap-2">
                      <span>{config.icon}</span>
                      <span>{config.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode Description */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              {currentConfig.description}
            </p>
          </div>

          {/* Parameter Status for non-custom modes */}
          {policy.mode !== 'CUSTOM' && parameterStatus && (
            <Alert variant={parameterStatus === 'matching' ? 'default' : 'destructive'}>
              <div className="flex items-center gap-2">
                {parameterStatus === 'matching' ? (
                  <CheckCircleIcon className="h-4 w-4" />
                ) : (
                  <AlertTriangleIcon className="h-4 w-4" />
                )}
                <AlertDescription>
                  {parameterStatus === 'matching' 
                    ? `Parameters match ${currentConfig.name} defaults`
                    : `Parameters have been modified from ${currentConfig.name} defaults`
                  }
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Mode Features */}
          <div>
            <h4 className="text-sm font-medium mb-2">Key Features:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {currentConfig.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Warnings */}
          {currentConfig.warnings && currentConfig.warnings.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Important Considerations:</p>
                  <ul className="text-sm space-y-1">
                    {currentConfig.warnings.map((warning, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span>•</span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Parameter Lock Status */}
          {policy.mode !== 'CUSTOM' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <InfoIcon className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Parameter Lock Active</span>
              </div>
              <p className="text-sm text-blue-700">
                Most parameters are locked to ensure optimal {currentConfig.name.toLowerCase()} behavior. 
                Switch to Custom Mode to modify all parameters manually.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}