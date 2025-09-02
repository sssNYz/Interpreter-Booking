'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Settings
} from 'lucide-react';
import type { AssignmentPolicy } from '@/types/assignment';

interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  impact: ConfigImpactAssessment;
  timestamp: string;
}

interface ConfigImpactAssessment {
  existingPooledBookings: number;
  affectedBookings: number;
  modeChangeImpact?: {
    fromMode: string;
    toMode: string;
    poolEntriesAffected: number;
    immediateProcessingRequired: number;
    thresholdChanges: Array<{
      meetingType: string;
      oldUrgentThreshold: number;
      newUrgentThreshold: number;
      oldGeneralThreshold: number;
      newGeneralThreshold: number;
    }>;
    poolingBehaviorChange: string;
  };
  fairnessImpact?: {
    currentGap: number;
    projectedGap: number;
    gapChange: number;
    affectedInterpreters: number;
    fairnessImprovement: boolean;
    windowDaysChange?: number;
  };
  poolProcessingImpact?: {
    currentPoolSize: number;
    thresholdAdjustments: number;
    deadlineAdjustments: number;
    processingFrequencyChange?: string;
    batchProcessingChange?: string;
  };
  drPolicyImpact?: {
    blockingBehaviorChange?: string;
    penaltyChange: number;
    overrideAvailabilityChange?: boolean;
    affectedDRBookings: number;
    fairnessDistributionChange: string;
  };
}

interface ConfigValidationPanelProps {
  config: Partial<AssignmentPolicy>;
  onValidationComplete?: (result: ConfigValidationResult) => void;
  autoValidate?: boolean;
}

export function ConfigValidationPanel({ 
  config, 
  onValidationComplete, 
  autoValidate = true 
}: ConfigValidationPanelProps) {
  const [validationResult, setValidationResult] = useState<ConfigValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-validate when config changes
  useEffect(() => {
    if (autoValidate && Object.keys(config).length > 0) {
      validateConfiguration();
    }
  }, [config, autoValidate]);

  const validateConfiguration = async () => {
    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/config/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config,
          options: {
            skipImpactAssessment: false
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Validation failed');
      }

      const result = data.validation;
      setValidationResult(result);
      onValidationComplete?.(result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Configuration validation error:', err);
    } finally {
      setIsValidating(false);
    }
  };

  const getValidationStatusIcon = () => {
    if (isValidating) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (!validationResult) return <Settings className="h-4 w-4" />;
    if (validationResult.isValid) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getValidationStatusText = () => {
    if (isValidating) return 'Validating...';
    if (!validationResult) return 'Ready to validate';
    if (validationResult.isValid) return 'Configuration is valid';
    return 'Configuration has issues';
  };

  const getImpactLevel = (impact: ConfigImpactAssessment) => {
    if (impact.affectedBookings === 0) return { level: 'NONE', color: 'bg-gray-100 text-gray-800' };
    if (impact.affectedBookings < 5) return { level: 'LOW', color: 'bg-green-100 text-green-800' };
    if (impact.affectedBookings < 15) return { level: 'MEDIUM', color: 'bg-yellow-100 text-yellow-800' };
    return { level: 'HIGH', color: 'bg-red-100 text-red-800' };
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getValidationStatusIcon()}
          Configuration Validation
        </CardTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{getValidationStatusText()}</span>
          <Button 
            onClick={validateConfiguration} 
            disabled={isValidating}
            size="sm"
            variant="outline"
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert className="mb-4">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {validationResult && (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="impact">Impact</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {validationResult.isValid ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {validationResult.isValid ? 'Valid Configuration' : 'Invalid Configuration'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Validated at {new Date(validationResult.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getImpactLevel(validationResult.impact).color}>
                      {getImpactLevel(validationResult.impact).level} IMPACT
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {validationResult.impact.affectedBookings} of {validationResult.impact.existingPooledBookings} pooled bookings affected
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {validationResult.errors.length}
                  </div>
                  <div className="text-sm text-gray-600">Errors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {validationResult.warnings.length}
                  </div>
                  <div className="text-sm text-gray-600">Warnings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {validationResult.recommendations.length}
                  </div>
                  <div className="text-sm text-gray-600">Recommendations</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="issues" className="space-y-4">
              {validationResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Errors ({validationResult.errors.length})
                  </h4>
                  {validationResult.errors.map((error, index) => (
                    <Alert key={index} className="border-red-200">
                      <AlertDescription className="text-red-800">{error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-yellow-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings ({validationResult.warnings.length})
                  </h4>
                  {validationResult.warnings.map((warning, index) => (
                    <Alert key={index} className="border-yellow-200">
                      <AlertDescription className="text-yellow-800">{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {validationResult.errors.length === 0 && validationResult.warnings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No issues found with this configuration</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="impact" className="space-y-4">
              {validationResult.impact.modeChangeImpact && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Mode Change Impact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Mode Transition:</span>
                      <Badge variant="outline">
                        {validationResult.impact.modeChangeImpact.fromMode} → {validationResult.impact.modeChangeImpact.toMode}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pool Entries Affected:</span>
                      <span className="font-medium">{validationResult.impact.modeChangeImpact.poolEntriesAffected}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Immediate Processing Required:</span>
                      <span className="font-medium">{validationResult.impact.modeChangeImpact.immediateProcessingRequired}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      {validationResult.impact.modeChangeImpact.poolingBehaviorChange}
                    </div>
                  </CardContent>
                </Card>
              )}

              {validationResult.impact.fairnessImpact && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Fairness Impact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Current Fairness Gap:</span>
                      <span className="font-medium">{validationResult.impact.fairnessImpact.currentGap.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Projected Fairness Gap:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{validationResult.impact.fairnessImpact.projectedGap.toFixed(1)}h</span>
                        {validationResult.impact.fairnessImpact.fairnessImprovement ? (
                          <TrendingDown className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Affected Interpreters:</span>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{validationResult.impact.fairnessImpact.affectedInterpreters}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {validationResult.impact.drPolicyImpact && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">DR Policy Impact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {validationResult.impact.drPolicyImpact.blockingBehaviorChange && (
                      <div className="flex items-center justify-between">
                        <span>Blocking Behavior:</span>
                        <Badge variant="outline">{validationResult.impact.drPolicyImpact.blockingBehaviorChange}</Badge>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>Penalty Change:</span>
                      <span className={`font-medium ${validationResult.impact.drPolicyImpact.penaltyChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {validationResult.impact.drPolicyImpact.penaltyChange > 0 ? '+' : ''}{validationResult.impact.drPolicyImpact.penaltyChange.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Affected DR Bookings:</span>
                      <span className="font-medium">{validationResult.impact.drPolicyImpact.affectedDRBookings}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      {validationResult.impact.drPolicyImpact.fairnessDistributionChange}
                    </div>
                  </CardContent>
                </Card>
              )}

              {!validationResult.impact.modeChangeImpact && 
               !validationResult.impact.fairnessImpact && 
               !validationResult.impact.drPolicyImpact && (
                <div className="text-center py-8 text-gray-500">
                  <Info className="h-12 w-12 mx-auto mb-2" />
                  <p>No significant impact detected</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              {validationResult.recommendations.length > 0 ? (
                <div className="space-y-2">
                  {validationResult.recommendations.map((recommendation, index) => (
                    <Alert key={index} className="border-blue-200">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-blue-800">{recommendation}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No recommendations - configuration looks good!</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}