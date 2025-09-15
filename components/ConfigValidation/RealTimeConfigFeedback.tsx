'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info,
  Zap,
  Clock,
  Users,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import type { AssignmentPolicy } from '@/types/assignment';

interface RealTimeValidation {
  field: keyof AssignmentPolicy;
  isValid: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  suggestion?: string;
}

interface FieldValidationProps {
  field: keyof AssignmentPolicy;
  value: any;
  currentConfig: AssignmentPolicy;
  onValidation: (validation: RealTimeValidation) => void;
}

interface RealTimeConfigFeedbackProps {
  config: Partial<AssignmentPolicy>;
  currentConfig: AssignmentPolicy;
  onChange?: (field: keyof AssignmentPolicy, validation: RealTimeValidation) => void;
}

// Individual field validator component
function FieldValidator({ field, value, currentConfig, onValidation }: FieldValidationProps) {
  useEffect(() => {
    const validateField = () => {
      let validation: RealTimeValidation;

      switch (field) {
        case 'fairnessWindowDays':
          validation = validateFairnessWindow(value, currentConfig);
          break;
        case 'maxGapHours':
          validation = validateMaxGapHours(value, currentConfig);
          break;
        case 'w_fair':
          validation = validateFairnessWeight(value, currentConfig);
          break;
        case 'w_urgency':
          validation = validateUrgencyWeight(value, currentConfig);
          break;
        case 'w_lrs':
          validation = validateLRSWeight(value, currentConfig);
          break;
        case 'drConsecutivePenalty':
          validation = validateDRPenalty(value, currentConfig);
          break;
        case 'mode':
          validation = validateMode(value, currentConfig);
          break;
        default:
          validation = {
            field,
            isValid: true,
            message: 'Valid',
            severity: 'success'
          };
      }

      onValidation(validation);
    };

    if (value !== undefined) {
      validateField();
    }
  }, [field, value, currentConfig, onValidation]);

  return null; // This component doesn't render anything
}

// Field validation functions
function validateFairnessWindow(value: number, config: AssignmentPolicy): RealTimeValidation {
  if (value < 7) {
    return {
      field: 'fairnessWindowDays',
      isValid: false,
      message: 'Fairness window must be at least 7 days',
      severity: 'error',
      suggestion: 'Set to 7 or higher for proper fairness calculation'
    };
  }

  if (value > 90) {
    return {
      field: 'fairnessWindowDays',
      isValid: false,
      message: 'Fairness window cannot exceed 90 days',
      severity: 'error',
      suggestion: 'Set to 90 or lower to avoid performance issues'
    };
  }

  if (value < 14) {
    return {
      field: 'fairnessWindowDays',
      isValid: true,
      message: 'Short fairness window may not provide sufficient data',
      severity: 'warning',
      suggestion: 'Consider 14+ days for better fairness distribution'
    };
  }

  if (config.mode === 'BALANCE' && value < 30) {
    return {
      field: 'fairnessWindowDays',
      isValid: true,
      message: 'Balance mode works best with longer fairness windows',
      severity: 'info',
      suggestion: 'Consider 30+ days for optimal Balance mode performance'
    };
  }

  if (config.mode === 'URGENT' && value > 21) {
    return {
      field: 'fairnessWindowDays',
      isValid: true,
      message: 'Urgent mode works best with shorter fairness windows',
      severity: 'info',
      suggestion: 'Consider 21 days or less for faster Urgent mode response'
    };
  }

  return {
    field: 'fairnessWindowDays',
    isValid: true,
    message: 'Fairness window is well-configured',
    severity: 'success'
  };
}

function validateMaxGapHours(value: number, config: AssignmentPolicy): RealTimeValidation {
  if (value < 1) {
    return {
      field: 'maxGapHours',
      isValid: false,
      message: 'Maximum gap must be at least 1 hour',
      severity: 'error',
      suggestion: 'Set to 1 or higher'
    };
  }

  if (value > 100) {
    return {
      field: 'maxGapHours',
      isValid: false,
      message: 'Maximum gap cannot exceed 100 hours',
      severity: 'error',
      suggestion: 'Set to 100 or lower'
    };
  }

  if (value < 2) {
    return {
      field: 'maxGapHours',
      isValid: true,
      message: 'Very low max gap may cause assignment failures',
      severity: 'warning',
      suggestion: 'Consider 2+ hours to reduce assignment failures'
    };
  }

  if (config.mode === 'BALANCE' && value > 5) {
    return {
      field: 'maxGapHours',
      isValid: true,
      message: 'Balance mode works best with tighter gap control',
      severity: 'info',
      suggestion: 'Consider 5 hours or less for optimal fairness'
    };
  }

  if (config.mode === 'URGENT' && value < 5) {
    return {
      field: 'maxGapHours',
      isValid: true,
      message: 'Urgent mode may need higher gap for flexibility',
      severity: 'info',
      suggestion: 'Consider 5+ hours for better assignment flexibility'
    };
  }

  return {
    field: 'maxGapHours',
    isValid: true,
    message: 'Maximum gap hours is well-configured',
    severity: 'success'
  };
}

function validateFairnessWeight(value: number, config: AssignmentPolicy): RealTimeValidation {
  if (value < 0 || value > 5) {
    return {
      field: 'w_fair',
      isValid: false,
      message: 'Fairness weight must be between 0 and 5',
      severity: 'error',
      suggestion: 'Set between 0 and 5'
    };
  }

  if (value < 0.5) {
    return {
      field: 'w_fair',
      isValid: true,
      message: 'Very low fairness weight may cause uneven distribution',
      severity: 'warning',
      suggestion: 'Consider 0.5+ for better workload balance'
    };
  }

  if (config.mode === 'BALANCE' && value <= config.w_urgency) {
    return {
      field: 'w_fair',
      isValid: true,
      message: 'Balance mode should prioritize fairness over urgency',
      severity: 'info',
      suggestion: 'Set fairness weight higher than urgency weight'
    };
  }

  return {
    field: 'w_fair',
    isValid: true,
    message: 'Fairness weight is appropriate',
    severity: 'success'
  };
}

function validateUrgencyWeight(value: number, config: AssignmentPolicy): RealTimeValidation {
  if (value < 0 || value > 5) {
    return {
      field: 'w_urgency',
      isValid: false,
      message: 'Urgency weight must be between 0 and 5',
      severity: 'error',
      suggestion: 'Set between 0 and 5'
    };
  }

  if (value < 0.3) {
    return {
      field: 'w_urgency',
      isValid: true,
      message: 'Very low urgency weight may not prioritize time-sensitive bookings',
      severity: 'warning',
      suggestion: 'Consider 0.3+ for proper urgency handling'
    };
  }

  if (config.mode === 'URGENT' && value <= config.w_fair) {
    return {
      field: 'w_urgency',
      isValid: true,
      message: 'Urgent mode should prioritize urgency over fairness',
      severity: 'info',
      suggestion: 'Set urgency weight higher than fairness weight'
    };
  }

  return {
    field: 'w_urgency',
    isValid: true,
    message: 'Urgency weight is appropriate',
    severity: 'success'
  };
}

function validateLRSWeight(value: number, config: AssignmentPolicy): RealTimeValidation {
  if (value < 0 || value > 5) {
    return {
      field: 'w_lrs',
      isValid: false,
      message: 'LRS weight must be between 0 and 5',
      severity: 'error',
      suggestion: 'Set between 0 and 5'
    };
  }

  return {
    field: 'w_lrs',
    isValid: true,
    message: 'LRS weight is valid',
    severity: 'success'
  };
}

function validateDRPenalty(value: number, config: AssignmentPolicy): RealTimeValidation {
  if (value > 0) {
    return {
      field: 'drConsecutivePenalty',
      isValid: false,
      message: 'DR penalty must be negative (penalty reduces score)',
      severity: 'error',
      suggestion: 'Set to a negative value (e.g., -0.5)'
    };
  }

  if (value < -2.0) {
    return {
      field: 'drConsecutivePenalty',
      isValid: true,
      message: 'Very large penalty may cause assignment failures',
      severity: 'warning',
      suggestion: 'Consider -2.0 or higher to avoid blocking all assignments'
    };
  }

  if (config.mode === 'BALANCE' && value > -0.5) {
    return {
      field: 'drConsecutivePenalty',
      isValid: true,
      message: 'Balance mode works best with stronger DR penalties',
      severity: 'info',
      suggestion: 'Consider -0.5 or lower for better fairness'
    };
  }

  if (config.mode === 'URGENT' && value < -0.3) {
    return {
      field: 'drConsecutivePenalty',
      isValid: true,
      message: 'Urgent mode should use minimal DR penalties',
      severity: 'info',
      suggestion: 'Consider -0.3 or higher for immediate assignment priority'
    };
  }

  return {
    field: 'drConsecutivePenalty',
    isValid: true,
    message: 'DR penalty is well-configured',
    severity: 'success'
  };
}

function validateMode(value: AssignmentPolicy['mode'], config: AssignmentPolicy): RealTimeValidation {
  if (!['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'].includes(value)) {
    return {
      field: 'mode',
      isValid: false,
      message: 'Invalid mode selected',
      severity: 'error',
      suggestion: 'Select BALANCE, URGENT, NORMAL, or CUSTOM'
    };
  }

  return {
    field: 'mode',
    isValid: true,
    message: `${value} mode selected`,
    severity: 'success'
  };
}

export function RealTimeConfigFeedback({ 
  config, 
  currentConfig, 
  onChange 
}: RealTimeConfigFeedbackProps) {
  const [validations, setValidations] = useState<Map<keyof AssignmentPolicy, RealTimeValidation>>(new Map());
  const [overallScore, setOverallScore] = useState(100);

  const handleValidation = useCallback((validation: RealTimeValidation) => {
    setValidations(prev => {
      const newValidations = new Map(prev);
      newValidations.set(validation.field, validation);
      return newValidations;
    });

    onChange?.(validation.field, validation);
  }, [onChange]);

  // Calculate overall configuration score
  useEffect(() => {
    const validationArray = Array.from(validations.values());
    if (validationArray.length === 0) {
      setOverallScore(100);
      return;
    }

    let score = 100;
    validationArray.forEach(validation => {
      if (!validation.isValid) {
        score -= 20; // Major penalty for errors
      } else if (validation.severity === 'warning') {
        score -= 10; // Medium penalty for warnings
      } else if (validation.severity === 'info') {
        score -= 5; // Minor penalty for suggestions
      }
    });

    setOverallScore(Math.max(0, score));
  }, [validations]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (score >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const errorCount = Array.from(validations.values()).filter(v => !v.isValid).length;
  const warningCount = Array.from(validations.values()).filter(v => v.isValid && v.severity === 'warning').length;
  const infoCount = Array.from(validations.values()).filter(v => v.isValid && v.severity === 'info').length;

  return (
    <div className="space-y-4">
      {/* Render field validators */}
      {Object.entries(config).map(([field, value]) => (
        <FieldValidator
          key={field}
          field={field as keyof AssignmentPolicy}
          value={value}
          currentConfig={currentConfig}
          onValidation={handleValidation}
        />
      ))}

      {/* Overall score card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getScoreIcon(overallScore)}
              Configuration Score
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}%
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={overallScore} className="mb-4" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-red-600">{errorCount}</div>
              <div className="text-sm text-gray-600">Errors</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-yellow-600">{warningCount}</div>
              <div className="text-sm text-gray-600">Warnings</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-600">{infoCount}</div>
              <div className="text-sm text-gray-600">Suggestions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time feedback messages */}
      <div className="space-y-2">
        {Array.from(validations.values())
          .filter(validation => validation.severity !== 'success')
          .map((validation, index) => (
            <Alert 
              key={`${validation.field}-${index}`}
              className={
                validation.severity === 'error' ? 'border-red-200' :
                validation.severity === 'warning' ? 'border-yellow-200' :
                'border-blue-200'
              }
            >
              {validation.severity === 'error' && <XCircle className="h-4 w-4" />}
              {validation.severity === 'warning' && <AlertTriangle className="h-4 w-4" />}
              {validation.severity === 'info' && <Info className="h-4 w-4" />}
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <strong>{validation.field}:</strong> {validation.message}
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {validation.field}
                  </Badge>
                </div>
                {validation.suggestion && (
                  <div className="mt-1 text-sm opacity-80">
                    💡 {validation.suggestion}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          ))}
      </div>

      {/* Success message when all validations pass */}
      {Array.from(validations.values()).every(v => v.severity === 'success') && validations.size > 0 && (
        <Alert className="border-green-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-green-800">
            All configuration parameters are valid and well-configured! 🎉
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}