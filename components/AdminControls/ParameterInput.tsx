"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { InfoIcon, AlertTriangleIcon, LockIcon } from "lucide-react";
import type { AssignmentPolicy } from "@/types/assignment";

interface ParameterInputProps {
  policy: AssignmentPolicy;
  onPolicyUpdate: (updates: Partial<AssignmentPolicy>) => void;
}

interface ParameterConfig {
  key: keyof AssignmentPolicy;
  label: string;
  description: string;
  type: "slider" | "input";
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (value: number) => string;
  warnings?: {
    condition: (value: number) => boolean;
    message: string;
    severity: "warning" | "error";
  }[];
  recommendations?: {
    condition: (value: number) => boolean;
    message: string;
  }[];
}

const PARAMETER_CONFIGS: ParameterConfig[] = [
  {
    key: "fairnessWindowDays",
    label: "Fairness Window",
    description:
      "Number of days to look back when calculating workload balance. Longer windows provide more stable fairness but may be less responsive to recent changes.",
    type: "slider",
    min: 7,
    max: 90,
    step: 1,
    unit: "days",
    warnings: [
      {
        condition: (value) => value < 14,
        message:
          "Very short fairness windows may cause erratic assignment patterns",
        severity: "warning",
      },
      {
        condition: (value) => value > 60,
        message:
          "Very long fairness windows may not reflect current interpreter availability",
        severity: "warning",
      },
    ],
    recommendations: [
      {
        condition: (value) => value >= 30 && value <= 45,
        message: "Recommended range for most organizations",
      },
    ],
  },
  {
    key: "maxGapHours",
    label: "Maximum Hour Gap",
    description:
      "Maximum allowed difference in assigned hours between interpreters. Lower values enforce stricter fairness but may limit assignment flexibility.",
    type: "slider",
    min: 1,
    max: 100,
    step: 1,
    unit: "hours",
    warnings: [
      {
        condition: (value) => value < 3,
        message:
          "Very strict hour gaps may prevent assignments when interpreters are unavailable",
        severity: "warning",
      },
      {
        condition: (value) => value > 20,
        message: "Large hour gaps may allow significant workload imbalances",
        severity: "warning",
      },
    ],
    recommendations: [
      {
        condition: (value) => value >= 5 && value <= 10,
        message: "Balanced approach for most scenarios",
      },
    ],
  },

  {
    key: "w_fair",
    label: "Fairness Weight",
    description:
      "Importance of workload balance in assignment decisions. Higher values prioritize equal distribution of hours.",
    type: "slider",
    min: 0,
    max: 5,
    step: 0.1,
    format: (value) => value.toFixed(1),
    warnings: [
      {
        condition: (value) => value < 0.5,
        message:
          "Very low fairness weight may create significant workload imbalances",
        severity: "warning",
      },
      {
        condition: (value) => value > 3,
        message: "Very high fairness weight may prevent urgent assignments",
        severity: "warning",
      },
    ],
    recommendations: [
      {
        condition: (value) => value >= 1.0 && value <= 2.0,
        message: "Balanced fairness weighting",
      },
    ],
  },
  {
    key: "w_urgency",
    label: "Urgency Weight",
    description:
      "Importance of booking urgency in assignment decisions. Higher values ensure time-critical bookings are assigned quickly.",
    type: "slider",
    min: 0,
    max: 5,
    step: 0.1,
    format: (value) => value.toFixed(1),
    warnings: [
      {
        condition: (value) => value < 0.3,
        message: "Very low urgency weight may delay critical assignments",
        severity: "error",
      },
      {
        condition: (value) => value > 3,
        message:
          "Very high urgency weight may override fairness considerations",
        severity: "warning",
      },
    ],
    recommendations: [
      {
        condition: (value) => value >= 0.8 && value <= 1.5,
        message: "Balanced urgency handling",
      },
    ],
  },
  {
    key: "w_lrs",
    label: "Rotation Weight (LRS)",
    description:
      "Importance of recent assignment history in decisions. Higher values ensure interpreters who haven't worked recently get priority.",
    type: "slider",
    min: 0,
    max: 5,
    step: 0.1,
    format: (value) => value.toFixed(1),
    warnings: [
      {
        condition: (value) => value > 2,
        message:
          "Very high rotation weight may override other important factors",
        severity: "warning",
      },
    ],
    recommendations: [
      {
        condition: (value) => value >= 0.3 && value <= 0.8,
        message: "Effective rotation encouragement",
      },
    ],
  },
  {
    key: "drConsecutivePenalty",
    label: "DR Consecutive Penalty",
    description:
      "Penalty applied to interpreters with recent DR assignments to prevent burnout. More negative values create stronger penalties.",
    type: "slider",
    min: -2,
    max: 0,
    step: 0.1,
    format: (value) => value.toFixed(1),
    warnings: [
      {
        condition: (value) => value > -0.2,
        message:
          "Very light DR penalties may not prevent consecutive assignments effectively",
        severity: "warning",
      },
      {
        condition: (value) => value < -1.5,
        message: "Very heavy DR penalties may prevent DR coverage when needed",
        severity: "warning",
      },
    ],
    recommendations: [
      {
        condition: (value) => value >= -0.8 && value <= -0.3,
        message: "Effective DR rotation encouragement",
      },
    ],
  },
];

export default function ParameterInput({
  policy,
  onPolicyUpdate,
}: ParameterInputProps) {
  const [validationResults, setValidationResults] = useState<
    Record<string, any>
  >({});
  const isCustomMode = policy.mode === "CUSTOM";

  useEffect(() => {
    // Validate all parameters when policy changes
    const results: Record<string, any> = {};
    PARAMETER_CONFIGS.forEach((config) => {
      const value = policy[config.key] as number;
      results[config.key] = validateParameter(config, value);
    });
    setValidationResults(results);
  }, [policy]);

  const validateParameter = (config: ParameterConfig, value: number) => {
    const warnings = config.warnings?.filter((w) => w.condition(value)) || [];
    const recommendations =
      config.recommendations?.filter((r) => r.condition(value)) || [];

    return {
      warnings,
      recommendations,
      hasErrors: warnings.some((w) => w.severity === "error"),
      hasWarnings: warnings.some((w) => w.severity === "warning"),
    };
  };

  const updateParameter = (key: keyof AssignmentPolicy, value: number) => {
    onPolicyUpdate({ [key]: value });
  };

  const renderParameterInput = (config: ParameterConfig) => {
    const value = policy[config.key] as number;
    const validation = validationResults[config.key] || {};
    const displayValue = config.format
      ? config.format(value)
      : value.toString();

    return (
      <div key={config.key} className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor={config.key} className="text-sm font-medium">
              {config.label}
            </Label>
            {!isCustomMode && (
              <Tooltip>
                <TooltipTrigger>
                  <LockIcon className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Locked in {policy.mode} mode</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{config.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            {validation.recommendations?.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                Recommended
              </Badge>
            )}
            <span
              className={`text-sm font-mono ${
                !isCustomMode ? "text-muted-foreground" : ""
              }`}
            >
              {displayValue}
              {config.unit && ` ${config.unit}`}
            </span>
          </div>
        </div>

        {config.type === "slider" ? (
          <Slider
            id={config.key}
            value={[value]}
            onValueChange={([newValue]) =>
              updateParameter(config.key, newValue)
            }
            min={config.min}
            max={config.max}
            step={config.step}
            disabled={!isCustomMode}
            className={!isCustomMode ? "opacity-50" : ""}
          />
        ) : (
          <Input
            id={config.key}
            type="number"
            value={value}
            onChange={(e) =>
              updateParameter(config.key, parseFloat(e.target.value) || 0)
            }
            min={config.min}
            max={config.max}
            step={config.step}
            disabled={!isCustomMode}
            className={!isCustomMode ? "opacity-50" : ""}
          />
        )}

        {/* Validation Messages */}
        {validation.warnings?.map((warning: any, index: number) => (
          <Alert
            key={index}
            variant={warning.severity === "error" ? "destructive" : "default"}
          >
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {warning.message}
            </AlertDescription>
          </Alert>
        ))}

        {validation.recommendations?.map((rec: any, index: number) => (
          <Alert
            key={index}
            variant="default"
            className="border-green-200 bg-green-50"
          >
            <InfoIcon className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-800">
              {rec.message}
            </AlertDescription>
          </Alert>
        ))}
      </div>
    );
  };

  const fairnessParams = PARAMETER_CONFIGS.filter((c) =>
    ["fairnessWindowDays", "maxGapHours"].includes(c.key)
  );

  const scoringParams = PARAMETER_CONFIGS.filter((c) =>
    ["w_fair", "w_urgency", "w_lrs", "drConsecutivePenalty"].includes(c.key)
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Fairness Settings */}
        {isCustomMode && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Fairness Settings
              </CardTitle>
              <CardDescription>
                Configure workload balance and fairness parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {fairnessParams.map(renderParameterInput)}
            </CardContent>
          </Card>
        )}

        {/* Scoring Weights */}
        {isCustomMode && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Scoring Weights
              </CardTitle>
              <CardDescription>
                Configure the importance of different factors in interpreter
                selection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {scoringParams.map(renderParameterInput)}
            </CardContent>
          </Card>
        )}

        {/* Parameter Summary for Custom Mode */}
        {isCustomMode && (
          <Card>
            <CardHeader>
              <CardTitle>Configuration Summary</CardTitle>
              <CardDescription>
                Overview of your custom parameter configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Fairness Focus</h4>
                  <p className="text-muted-foreground">
                    {policy.w_fair > 1.5
                      ? "High"
                      : policy.w_fair > 0.8
                      ? "Medium"
                      : "Low"}{" "}
                    priority on workload balance
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Urgency Response</h4>
                  <p className="text-muted-foreground">
                    {policy.w_urgency > 1.5
                      ? "High"
                      : policy.w_urgency > 0.8
                      ? "Medium"
                      : "Low"}{" "}
                    priority on time-critical bookings
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Rotation Emphasis</h4>
                  <p className="text-muted-foreground">
                    {policy.w_lrs > 0.6
                      ? "High"
                      : policy.w_lrs > 0.3
                      ? "Medium"
                      : "Low"}{" "}
                    emphasis on recent assignment history
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">DR Protection</h4>
                  <p className="text-muted-foreground">
                    {policy.drConsecutivePenalty < -0.8
                      ? "Strong"
                      : policy.drConsecutivePenalty < -0.4
                      ? "Moderate"
                      : "Light"}{" "}
                    consecutive DR prevention
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
