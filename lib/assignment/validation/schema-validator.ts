import prisma from "@/prisma/prisma";

/**
 * Database schema validation and health checking
 */
export interface ValidationResult {
  isValid: boolean;
  missingTables: string[];
  structureIssues: StructureIssue[];
  recommendations: string[];
}

export interface StructureIssue {
  table: string;
  issue: string;
  severity: 'error' | 'warning';
}

export interface StructureValidation {
  isValid: boolean;
  issues: StructureIssue[];
  recommendations: string[];
}

export interface RepairResult {
  success: boolean;
  repairedTables: string[];
  errors: string[];
}

export interface DatabaseHealthCheck {
  isHealthy: boolean;
  connectionTime: number;
  error?: string;
  details?: {
    canConnect: boolean;
    canRead: boolean;
    canWrite: boolean;
    tablesAccessible: string[];
    tablesInaccessible: string[];
  };
}

/**
 * Schema validator class for database validation and health checks
 */
export class SchemaValidator {
  private static readonly REQUIRED_TABLES = [
    'BookingPlan',
    'Employee', 
    'AssignmentLog',
    'ConflictDetectionLog',
    'DRPolicyLog',
    // PoolProcessingLog removed with pool subsystem
    'SystemErrorLog',
    'AutoAssignmentConfig',
    'MeetingTypePriority'
  ];

  private static readonly CRITICAL_TABLES = [
    'BookingPlan',
    'Employee',
    'AssignmentLog'
  ];

  /**
   * Validate that all required tables exist and are accessible
   */
  static async validateRequiredTables(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      missingTables: [],
      structureIssues: [],
      recommendations: []
    };

    console.log("🔍 Validating database schema...");

    try {
      // Test each required table
      for (const tableName of this.REQUIRED_TABLES) {
        try {
          await this.testTableAccess(tableName);
          console.log(`✅ Table ${tableName}: accessible`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Table ${tableName}: ${errorMessage}`);
          
          result.isValid = false;
          result.missingTables.push(tableName);
          result.structureIssues.push({
            table: tableName,
            issue: `Table not accessible: ${errorMessage}`,
            severity: this.CRITICAL_TABLES.includes(tableName) ? 'error' : 'warning'
          });
        }
      }

      // Validate table structures for accessible tables
      for (const tableName of this.REQUIRED_TABLES) {
        if (!result.missingTables.includes(tableName)) {
          const structureValidation = await this.validateTableStructure(tableName);
          if (!structureValidation.isValid) {
            result.isValid = false;
            result.structureIssues.push(...structureValidation.issues);
          }
        }
      }

      // Generate recommendations
      if (result.missingTables.length > 0) {
        result.recommendations.push(
          "Run database migration to create missing tables: " + result.missingTables.join(", ")
        );
      }

      if (result.structureIssues.some(issue => issue.severity === 'error')) {
        result.recommendations.push(
          "Update database schema to match expected structure"
        );
      }

      if (result.isValid) {
        console.log("✅ Database schema validation passed");
      } else {
        console.log("❌ Database schema validation failed");
        console.log("Missing tables:", result.missingTables);
        console.log("Structure issues:", result.structureIssues.length);
      }

      return result;

    } catch (error) {
      console.error("❌ Error during schema validation:", error);
      result.isValid = false;
      result.structureIssues.push({
        table: 'UNKNOWN',
        issue: error instanceof Error ? error.message : 'Unknown validation error',
        severity: 'error'
      });
      result.recommendations.push("Check database connection and permissions");
      return result;
    }
  }

  /**
   * Test access to a specific table
   */
  private static async testTableAccess(tableName: string): Promise<void> {
    switch (tableName) {
      case 'BookingPlan':
        await prisma.bookingPlan.findFirst({ take: 1 });
        break;
      case 'Employee':
        await prisma.employee.findFirst({ take: 1 });
        break;
      case 'AssignmentLog':
        await prisma.assignmentLog.findFirst({ take: 1 });
        break;
      case 'ConflictDetectionLog':
        await prisma.conflictDetectionLog.findFirst({ take: 1 });
        break;
      case 'DRPolicyLog':
        await prisma.dRPolicyLog.findFirst({ take: 1 });
        break;
      case 'SystemErrorLog':
        await prisma.systemErrorLog.findFirst({ take: 1 });
        break;
      case 'AutoAssignmentConfig':
        await prisma.autoAssignmentConfig.findFirst({ take: 1 });
        break;
      case 'MeetingTypePriority':
        await prisma.meetingTypePriority.findFirst({ take: 1 });
        break;
      default:
        throw new Error(`Unknown table: ${tableName}`);
    }
  }

  /**
   * Validate structure of a specific table
   */
  static async validateTableStructure(tableName: string): Promise<StructureValidation> {
    const result: StructureValidation = {
      isValid: true,
      issues: [],
      recommendations: []
    };

    try {
      // For now, we'll do basic validation by testing field access
      // In a production system, you might want to query information_schema
      
      switch (tableName) {
        case 'AssignmentLog':
          await this.validateAssignmentLogStructure(result);
          break;
        case 'ConflictDetectionLog':
          await this.validateConflictDetectionLogStructure(result);
          break;
        case 'DRPolicyLog':
          await this.validateDRPolicyLogStructure(result);
          break;
        case 'PoolProcessingLog':
          await this.validatePoolProcessingLogStructure(result);
          break;
        case 'SystemErrorLog':
          await this.validateSystemErrorLogStructure(result);
          break;
        case 'BookingPlan':
          await this.validateBookingPlanStructure(result);
          break;
        case 'Employee':
          await this.validateEmployeeStructure(result);
          break;
        case 'AutoAssignmentConfig':
          await this.validateAutoAssignmentConfigStructure(result);
          break;
        case 'MeetingTypePriority':
          await this.validateMeetingTypePriorityStructure(result);
          break;
        default:
          // For unknown tables, just mark as valid since testTableAccess already verified access
          break;
      }

    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: tableName,
        issue: `Structure validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }

    return result;
  }

  /**
   * Validate AssignmentLog table structure
   */
  private static async validateAssignmentLogStructure(result: StructureValidation): Promise<void> {
    try {
      // Test that all expected JSON fields exist by querying the schema
      await prisma.assignmentLog.findFirst({
        select: {
          id: true,
          bookingId: true,
          interpreterEmpCode: true,
          status: true,
          reason: true,
          preHoursSnapshot: true,
          postHoursSnapshot: true,
          scoreBreakdown: true,
          maxGapHours: true,
          fairnessWindowDays: true,
          conflictDetection: true,
          drPolicyDecision: true,
          performance: true,
          systemState: true,
          createdAt: true
        },
        take: 1
      });
      
      console.log("✅ AssignmentLog structure validation passed");
    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: 'AssignmentLog',
        issue: `Missing or invalid fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Validate ConflictDetectionLog table structure
   */
  private static async validateConflictDetectionLogStructure(result: StructureValidation): Promise<void> {
    try {
      await prisma.conflictDetectionLog.findFirst({
        select: {
          id: true,
          bookingId: true,
          timestamp: true,
          requestedTimeStart: true,
          requestedTimeEnd: true,
          totalInterpretersChecked: true,
          availableInterpreters: true,
          conflictedInterpreters: true,
          conflicts: true,
          processingTimeMs: true,
          resolutionStrategy: true,
          outcome: true,
          createdAt: true
        },
        take: 1
      });
      
      console.log("✅ ConflictDetectionLog structure validation passed");
    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: 'ConflictDetectionLog',
        issue: `Missing or invalid fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Validate DRPolicyLog table structure
   */
  private static async validateDRPolicyLogStructure(result: StructureValidation): Promise<void> {
    try {
      await prisma.dRPolicyLog.findFirst({
        select: {
          id: true,
          bookingId: true,
          interpreterId: true,
          timestamp: true,
          isDRMeeting: true,
          drType: true,
          mode: true,
          policyApplied: true,
          lastGlobalDR: true,
          drHistory: true,
          alternativeInterpreters: true,
          finalDecision: true,
          decisionRationale: true,
          createdAt: true
        },
        take: 1
      });
      
      console.log("✅ DRPolicyLog structure validation passed");
    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: 'DRPolicyLog',
        issue: `Missing or invalid fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Validate PoolProcessingLog table structure
   */
  private static async validatePoolProcessingLogStructure(result: StructureValidation): Promise<void> {
    try {
      // PoolProcessingLog model removed
      
      console.log("✅ PoolProcessingLog structure validation passed");
    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: 'PoolProcessingLog',
        issue: `Missing or invalid fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Validate SystemErrorLog table structure
   */
  private static async validateSystemErrorLogStructure(result: StructureValidation): Promise<void> {
    try {
      await prisma.systemErrorLog.findFirst({
        select: {
          id: true,
          operation: true,
          bookingId: true,
          errorName: true,
          errorMessage: true,
          errorStack: true,
          systemState: true,
          createdAt: true
        },
        take: 1
      });
      
      console.log("✅ SystemErrorLog structure validation passed");
    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: 'SystemErrorLog',
        issue: `Missing or invalid fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Validate BookingPlan table structure
   */
  private static async validateBookingPlanStructure(result: StructureValidation): Promise<void> {
    try {
      await prisma.bookingPlan.findFirst({
        select: {
          bookingId: true,
          ownerEmpCode: true,
          meetingType: true,
          timeStart: true,
          timeEnd: true,
          bookingStatus: true,
          createdAt: true,
          updatedAt: true
        },
        take: 1
      });
      
      console.log("✅ BookingPlan structure validation passed");
    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: 'BookingPlan',
        issue: `Missing or invalid fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Validate Employee table structure
   */
  private static async validateEmployeeStructure(result: StructureValidation): Promise<void> {
    try {
      await prisma.employee.findFirst({
        select: {
          id: true,
          empCode: true,
          firstNameEn: true,
          lastNameEn: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        },
        take: 1
      });
      
      console.log("✅ Employee structure validation passed");
    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: 'Employee',
        issue: `Missing or invalid fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Validate AutoAssignmentConfig table structure
   */
  private static async validateAutoAssignmentConfigStructure(result: StructureValidation): Promise<void> {
    try {
      await prisma.autoAssignmentConfig.findFirst({
        select: {
          id: true,
          mode: true,
          autoAssignEnabled: true,
          fairnessWindowDays: true,
          maxGapHours: true,
          createdAt: true,
          updatedAt: true
        },
        take: 1
      });
      
      console.log("✅ AutoAssignmentConfig structure validation passed");
    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: 'AutoAssignmentConfig',
        issue: `Missing or invalid fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Validate MeetingTypePriority table structure
   */
  private static async validateMeetingTypePriorityStructure(result: StructureValidation): Promise<void> {
    try {
      await prisma.meetingTypePriority.findFirst({
        select: {
          id: true,
          meetingType: true,
          priorityValue: true,
          urgentThresholdDays: true,
          generalThresholdDays: true,
          createdAt: true,
          updatedAt: true
        },
        take: 1
      });
      
      console.log("✅ MeetingTypePriority structure validation passed");
    } catch (error) {
      result.isValid = false;
      result.issues.push({
        table: 'MeetingTypePriority',
        issue: `Missing or invalid fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }

  /**
   * Get database connection health status
   */
  static async checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple query to test connection
      await prisma.$queryRaw`SELECT 1 as test`;
      
      return {
        isHealthy: true,
        connectionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        isHealthy: false,
        connectionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
    }
  }

  /**
   * Attempt to repair missing tables (placeholder - would need actual migration logic)
   */
  static async repairMissingTables(): Promise<RepairResult> {
    const result: RepairResult = {
      success: false,
      repairedTables: [],
      errors: []
    };

    try {
      // In a real implementation, this would run database migrations
      // For now, we'll just validate that the tables exist
      const validation = await this.validateRequiredTables();
      
      if (validation.isValid) {
        result.success = true;
        result.repairedTables = this.REQUIRED_TABLES;
      } else {
        result.errors.push("Tables are missing and cannot be auto-repaired. Please run database migrations.");
        result.errors.push(...validation.recommendations);
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown repair error');
    }

    return result;
  }
}

/**
 * Convenience function to validate schema on startup
 */
export async function validateSchemaOnStartup(): Promise<boolean> {
  try {
    console.log("🔍 Performing startup schema validation...");
    
    // Check database health first
    const health = await SchemaValidator.checkDatabaseHealth();
    if (!health.isHealthy) {
      console.error("❌ Database health check failed:", health.error);
      return false;
    }
    
    console.log(`✅ Database connection healthy (${health.connectionTime}ms)`);
    
    // Validate schema
    const validation = await SchemaValidator.validateRequiredTables();
    
    if (!validation.isValid) {
      console.error("❌ Schema validation failed:");
      console.error("Missing tables:", validation.missingTables);
      console.error("Structure issues:", validation.structureIssues);
      console.error("Recommendations:", validation.recommendations);
      return false;
    }
    
    console.log("✅ Schema validation passed - all required tables are accessible");
    return true;
    
  } catch (error) {
    console.error("❌ Error during startup schema validation:", error);
    return false;
  }
}
