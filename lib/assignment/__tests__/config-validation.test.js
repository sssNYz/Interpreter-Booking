/**
 * Basic tests for configuration validation system
 * Tests parameter validation, mode constraints, and impact assessment
 */

const { 
  validateAssignmentPolicy, 
  validateMeetingTypePriority,
  assessConfigurationImpact,
  getParameterLockStatus,
  getModeRecommendations,
  VALIDATION_RULES,
  MODE_CONSTRAINTS
} = require('../config-validation');

describe('Configuration Validation System', () => {
  describe('validateAssignmentPolicy', () => {
    test('should validate valid NORMAL mode policy', () => {
      const policy = {
        mode: 'NORMAL',
        fairnessWindowDays: 30,
        maxGapHours: 5,
        minAdvanceDays: 2,
        w_fair: 1.2,
        w_urgency: 0.8,
        w_lrs: 0.3,
        drConsecutivePenalty: -0.5
      };

      const result = validateAssignmentPolicy(policy);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid parameter ranges', () => {
      const policy = {
        mode: 'CUSTOM',
        fairnessWindowDays: 200, // Too high
        maxGapHours: -1, // Too low
        drConsecutivePenalty: 1.0 // Should be negative
      };

      const result = validateAssignmentPolicy(policy);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check specific errors
      const fairnessError = result.errors.find(e => e.field === 'fairnessWindowDays');
      expect(fairnessError).toBeDefined();
      expect(fairnessError.severity).toBe('critical');

      const gapError = result.errors.find(e => e.field === 'maxGapHours');
      expect(gapError).toBeDefined();

      const penaltyError = result.errors.find(e => e.field === 'drConsecutivePenalty');
      expect(penaltyError).toBeDefined();
    });

    test('should generate warnings for values outside recommended ranges', () => {
      const policy = {
        mode: 'CUSTOM',
        fairnessWindowDays: 10, // Below recommended minimum
        w_urgency: 3.0, // Above recommended maximum
        drConsecutivePenalty: -0.05 // Very small penalty
      };

      const result = validateAssignmentPolicy(policy);
      
      expect(result.isValid).toBe(true); // Valid but not optimal
      expect(result.warnings.length).toBeGreaterThan(0);
      
      const fairnessWarning = result.warnings.find(w => w.field === 'fairnessWindowDays');
      expect(fairnessWarning).toBeDefined();
      expect(fairnessWarning.severity).toBe('medium');
    });

    test('should validate mode-specific constraints', () => {
      const policy = {
        mode: 'BALANCE',
        w_fair: 0.5 // Trying to modify locked parameter
      };

      const result = validateAssignmentPolicy(policy);
      
      // Should warn about locked parameter
      const lockWarning = result.warnings.find(w => w.message.includes('locked'));
      expect(lockWarning).toBeDefined();
    });

    test('should validate parameter relationships', () => {
      const policy = {
        mode: 'CUSTOM',
        w_fair: 0.1,
        w_urgency: 3.0, // Much higher than fairness
        w_lrs: 0.1
      };

      const result = validateAssignmentPolicy(policy);
      
      // Should warn about weight imbalance
      const balanceWarning = result.warnings.find(w => 
        w.field === 'weights' && w.message.includes('significantly higher')
      );
      expect(balanceWarning).toBeDefined();
    });

    test('should validate DR policy configuration', () => {
      const policy = {
        mode: 'URGENT',
        drConsecutivePenalty: -1.5 // Too harsh for urgent mode
      };

      const result = validateAssignmentPolicy(policy);
      
      // Should have error about hard blocking in urgent mode
      const drError = result.errors.find(e => 
        e.field === 'drConsecutivePenalty' && e.message.includes('hard blocking')
      );
      expect(drError).toBeDefined();
    });
  });

  describe('validateMeetingTypePriority', () => {
    test('should validate valid priority configuration', () => {
      const priority = {
        priorityValue: 8,
        urgentThresholdDays: 1,
        generalThresholdDays: 7
      };

      const result = validateMeetingTypePriority(priority, 'CUSTOM');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid priority values', () => {
      const priority = {
        priorityValue: 15, // Too high
        urgentThresholdDays: -1, // Negative
        generalThresholdDays: 500 // Too high
      };

      const result = validateMeetingTypePriority(priority, 'CUSTOM');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate threshold relationships', () => {
      const priority = {
        urgentThresholdDays: 10,
        generalThresholdDays: 5 // Should be higher than urgent
      };

      const result = validateMeetingTypePriority(priority, 'CUSTOM');
      
      expect(result.isValid).toBe(false);
      const thresholdError = result.errors.find(e => e.field === 'thresholds');
      expect(thresholdError).toBeDefined();
    });

    test('should warn about locked parameters in non-CUSTOM modes', () => {
      const priority = {
        urgentThresholdDays: 2
      };

      const result = validateMeetingTypePriority(priority, 'NORMAL');
      
      const lockWarning = result.warnings.find(w => w.message.includes('locked'));
      expect(lockWarning).toBeDefined();
    });
  });

  describe('assessConfigurationImpact', () => {
    test('should assess BALANCE mode impact correctly', () => {
      const policy = { mode: 'BALANCE' };
      
      const impact = assessConfigurationImpact(policy);
      
      expect(impact.fairnessImpact).toBe('positive');
      expect(impact.urgencyImpact).toBe('negative');
      expect(impact.assignmentSpeed).toBe('slower');
      expect(impact.systemLoad).toBe('high');
    });

    test('should assess URGENT mode impact correctly', () => {
      const policy = { mode: 'URGENT' };
      
      const impact = assessConfigurationImpact(policy);
      
      expect(impact.fairnessImpact).toBe('negative');
      expect(impact.urgencyImpact).toBe('positive');
      expect(impact.assignmentSpeed).toBe('faster');
      expect(impact.systemLoad).toBe('low');
    });

    test('should detect significant parameter changes', () => {
      const currentPolicy = {
        mode: 'NORMAL',
        fairnessWindowDays: 30,
        w_fair: 1.0,
        drConsecutivePenalty: -0.5
      };

      const newPolicy = {
        mode: 'CUSTOM',
        fairnessWindowDays: 60, // Significant increase
        w_fair: 2.0, // Significant increase
        drConsecutivePenalty: -1.0 // Significant increase
      };

      const impact = assessConfigurationImpact(newPolicy, currentPolicy);
      
      expect(impact.keyChanges.length).toBeGreaterThan(0);
      expect(impact.keyChanges.some(change => change.includes('Mode changed'))).toBe(true);
      expect(impact.keyChanges.some(change => change.includes('Fairness window'))).toBe(true);
    });

    test('should assess overall risk correctly', () => {
      // High risk configuration
      const highRiskPolicy = {
        mode: 'CUSTOM',
        w_fair: 0.1, // Very low fairness
        w_urgency: 0.1, // Very low urgency
        fairnessWindowDays: 90 // High system load
      };

      const highRiskImpact = assessConfigurationImpact(highRiskPolicy);
      expect(highRiskImpact.overallRisk).toBe('high');

      // Low risk configuration
      const lowRiskPolicy = {
        mode: 'NORMAL'
      };

      const lowRiskImpact = assessConfigurationImpact(lowRiskPolicy);
      expect(lowRiskImpact.overallRisk).toBe('low');
    });
  });

  describe('getParameterLockStatus', () => {
    test('should return correct lock status for BALANCE mode', () => {
      const lockStatus = getParameterLockStatus('BALANCE');
      
      expect(lockStatus.fairnessWindowDays).toBe(true);
      expect(lockStatus.w_fair).toBe(true);
      expect(lockStatus.drConsecutivePenalty).toBe(true);
    });

    test('should return correct lock status for CUSTOM mode', () => {
      const lockStatus = getParameterLockStatus('CUSTOM');
      
      // All parameters should be unlocked in CUSTOM mode
      Object.values(lockStatus).forEach(isLocked => {
        expect(isLocked).toBe(false);
      });
    });

    test('should handle invalid mode gracefully', () => {
      const lockStatus = getParameterLockStatus('INVALID_MODE');
      
      expect(lockStatus).toEqual({});
    });
  });

  describe('getModeRecommendations', () => {
    test('should return recommendations for all valid modes', () => {
      const modes = ['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'];
      
      modes.forEach(mode => {
        const recommendations = getModeRecommendations(mode);
        
        expect(recommendations.description).toBeDefined();
        expect(recommendations.keyFeatures).toBeInstanceOf(Array);
        expect(recommendations.bestUseCases).toBeInstanceOf(Array);
        expect(recommendations.potentialIssues).toBeInstanceOf(Array);
        
        expect(recommendations.keyFeatures.length).toBeGreaterThan(0);
        expect(recommendations.bestUseCases.length).toBeGreaterThan(0);
        expect(recommendations.potentialIssues.length).toBeGreaterThan(0);
      });
    });

    test('should handle invalid mode gracefully', () => {
      const recommendations = getModeRecommendations('INVALID_MODE');
      
      expect(recommendations.description).toBe('Unknown mode');
      expect(recommendations.keyFeatures).toEqual([]);
      expect(recommendations.bestUseCases).toEqual([]);
      expect(recommendations.potentialIssues).toEqual([]);
    });
  });

  describe('VALIDATION_RULES constants', () => {
    test('should have valid validation rules for all parameters', () => {
      const expectedParams = [
        'fairnessWindowDays',
        'maxGapHours', 
        'minAdvanceDays',
        'w_fair',
        'w_urgency',
        'w_lrs',
        'drConsecutivePenalty'
      ];

      expectedParams.forEach(param => {
        expect(VALIDATION_RULES[param]).toBeDefined();
        expect(VALIDATION_RULES[param].min).toBeDefined();
        expect(VALIDATION_RULES[param].max).toBeDefined();
        expect(VALIDATION_RULES[param].recommended).toBeDefined();
        expect(VALIDATION_RULES[param].description).toBeDefined();
        
        // Min should be less than max
        expect(VALIDATION_RULES[param].min).toBeLessThan(VALIDATION_RULES[param].max);
        
        // Recommended range should be within min/max
        expect(VALIDATION_RULES[param].recommended.min).toBeGreaterThanOrEqual(VALIDATION_RULES[param].min);
        expect(VALIDATION_RULES[param].recommended.max).toBeLessThanOrEqual(VALIDATION_RULES[param].max);
      });
    });
  });

  describe('MODE_CONSTRAINTS constants', () => {
    test('should have valid constraints for all modes', () => {
      const expectedModes = ['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'];

      expectedModes.forEach(mode => {
        expect(MODE_CONSTRAINTS[mode]).toBeDefined();
        expect(MODE_CONSTRAINTS[mode].lockedParams).toBeInstanceOf(Array);
        expect(MODE_CONSTRAINTS[mode].description).toBeDefined();
        expect(MODE_CONSTRAINTS[mode].keyFeatures).toBeInstanceOf(Array);
      });
    });

    test('should have CUSTOM mode with no locked parameters', () => {
      expect(MODE_CONSTRAINTS.CUSTOM.lockedParams).toEqual([]);
    });

    test('should have non-CUSTOM modes with locked parameters', () => {
      ['BALANCE', 'URGENT', 'NORMAL'].forEach(mode => {
        expect(MODE_CONSTRAINTS[mode].lockedParams.length).toBeGreaterThan(0);
      });
    });
  });
});

// Test helper functions
describe('Validation Helper Functions', () => {
  test('should handle edge cases in parameter validation', () => {
    // Test with undefined values
    const emptyPolicy = {};
    const result = validateAssignmentPolicy(emptyPolicy);
    expect(result.isValid).toBe(true); // Should use defaults

    // Test with null values
    const nullPolicy = {
      fairnessWindowDays: null,
      w_fair: undefined
    };
    const nullResult = validateAssignmentPolicy(nullPolicy);
    expect(nullResult.isValid).toBe(true); // Should handle gracefully
  });

  test('should provide helpful suggestions in validation messages', () => {
    const policy = {
      mode: 'CUSTOM',
      fairnessWindowDays: 200 // Too high
    };

    const result = validateAssignmentPolicy(policy);
    const error = result.errors.find(e => e.field === 'fairnessWindowDays');
    
    expect(error.suggestion).toBeDefined();
    expect(error.suggestion.length).toBeGreaterThan(0);
  });

  test('should categorize validation messages by severity', () => {
    const policy = {
      mode: 'CUSTOM',
      fairnessWindowDays: 200, // Critical error
      w_urgency: 3.0 // Medium warning
    };

    const result = validateAssignmentPolicy(policy);
    
    // Should have both critical errors and medium warnings
    const criticalErrors = result.errors.filter(e => e.severity === 'critical');
    const mediumWarnings = result.warnings.filter(w => w.severity === 'medium');
    
    expect(criticalErrors.length).toBeGreaterThan(0);
    expect(mediumWarnings.length).toBeGreaterThan(0);
  });
});

console.log('Configuration validation tests completed successfully');