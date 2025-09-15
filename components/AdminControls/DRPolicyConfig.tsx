"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon, AlertTriangleIcon } from "lucide-react";
import type { AssignmentPolicy } from "@/types/assignment";

interface DRPolicyConfigProps {
  policy: AssignmentPolicy;
  onPolicyUpdate: (updates: Partial<AssignmentPolicy>) => void;
}

export default function DRPolicyConfig({ policy, onPolicyUpdate }: DRPolicyConfigProps) {
  const getDRPolicyInfo = () => {
    switch (policy.mode) {
      case 'BALANCE':
        return {
          name: 'Strict Rotation',
          description: 'Hard blocks consecutive DR assignments for maximum fairness',
          behavior: 'Hard Block',
          penalty: -0.8,
          badge: 'success' as const
        };
      case 'URGENT':
        return {
          name: 'Emergency Coverage',
          description: 'Minimal penalties to ensure DR meetings are always covered',
          behavior: 'Soft Penalty',
          penalty: -0.1,
          badge: 'destructive' as const
        };
      case 'NORMAL':
        return {
          name: 'Flexible Penalty',
          description: 'Balanced approach with moderate penalties',
          behavior: 'Soft Penalty',
          penalty: -0.5,
          badge: 'secondary' as const
        };
      case 'CUSTOM':
        return {
          name: 'Custom Policy',
          description: 'User-configured DR assignment rules',
          behavior: policy.drConsecutivePenalty <= -1.0 ? 'Hard Block' : 'Soft Penalty',
          penalty: policy.drConsecutivePenalty,
          badge: 'default' as const
        };
      default:
        return {
          name: 'Standard Policy',
          description: 'Default DR assignment rules',
          behavior: 'Soft Penalty',
          penalty: -0.5,
          badge: 'secondary' as const
        };
    }
  };

  const drPolicyInfo = getDRPolicyInfo();

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            DR Assignment Policy
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Shows the DR policy automatically set by your selected mode</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>
            DR assignment rules are automatically configured based on your selected mode
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Policy Display */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">{drPolicyInfo.name}</h4>
              <Badge variant={drPolicyInfo.badge}>
                {policy.mode} Mode
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              {drPolicyInfo.description}
            </p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Consecutive Handling:</span>
                <div className="mt-1">
                  <Badge variant={drPolicyInfo.behavior === 'Hard Block' ? "destructive" : "secondary"} className="text-xs">
                    {drPolicyInfo.behavior}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="font-medium">Penalty Amount:</span>
                <div className="mt-1">
                  <span className="font-mono text-xs bg-background px-2 py-1 rounded border">
                    {drPolicyInfo.penalty.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mode-specific information */}
          <div className="space-y-3">
            {policy.mode === 'BALANCE' && (
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <strong>Balance Mode:</strong> Hard blocks consecutive DR assignments to ensure maximum fairness.
                  May require manual intervention if no other interpreters are available.
                </AlertDescription>
              </Alert>
            )}

            {policy.mode === 'URGENT' && (
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <strong>Urgent Mode:</strong> Uses minimal penalties to ensure DR meetings are always covered quickly.
                  May result in some workload imbalances.
                </AlertDescription>
              </Alert>
            )}

            {policy.mode === 'NORMAL' && (
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <strong>Normal Mode:</strong> Balanced approach that discourages but allows consecutive assignments when needed.
                  Good for most organizations.
                </AlertDescription>
              </Alert>
            )}

            {policy.mode === 'CUSTOM' && (
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <strong>Custom Mode:</strong> DR penalty is configurable via the DR Consecutive Penalty slider in the Scoring Weights section.
                  Values ≤ -1.0 create hard blocking, values &gt; -1.0 create soft penalties.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Policy Impact Summary */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Policy Impact</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>
                <strong>Fairness:</strong> {drPolicyInfo.behavior === 'Hard Block' ? 'High' : 'Medium'} -
                {drPolicyInfo.behavior === 'Hard Block'
                  ? ' Strict rotation ensures equal DR distribution'
                  : ' Penalties encourage rotation while allowing flexibility'
                }
              </p>
              <p>
                <strong>Coverage:</strong> {drPolicyInfo.behavior === 'Hard Block' ? 'Medium' : 'High'} -
                {drPolicyInfo.behavior === 'Hard Block'
                  ? ' May require manual intervention in emergencies'
                  : ' Flexible assignment ensures DR meetings are covered'
                }
              </p>
              <p>
                <strong>Complexity:</strong> Low - Simple global rotation is easy to understand and manage
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}