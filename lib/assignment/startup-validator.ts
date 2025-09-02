import { SchemaValidator, type ValidationResult, type DatabaseHealthCheck } from "./schema-validator";
import { getDatabaseConnectionManager } from "./database-connection-manager";
import { getComprehensiveErrorLogger, logErrorWithContext } from "./comprehensive-error-logger";
import { getResilientLogger } from "./resilient-logger";
import prisma from "@/prisma/prisma";

/**
 * Comprehensive startup validation with repair recommendations
 */
export interface StartupValidationResult {
  success: boolean;
  databaseHealth: DatabaseHealthCheck;
  schemaValidation: ValidationResult;
  systemChecks: SystemCheckResult[];
  repairRecommendations: RepairRecommendation[];
  warnings: string[];
  criticalIssues: string[];
  startupTime: number;
}

export interface SystemCheckResult {
  name: string;
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

export interface RepairRecommendation {
  issue: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'DATABASE' | 'SCHEMA' | 'CONFIGURATION' | 'SYSTEM' | 'PERMISSIONS';
  description: string;
  automaticRepair: boolean;
  repairSteps: string[];
  estimatedTime: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Startup validator with comprehensive system checks and repair recommendations
 */
export class StartupValidator {
  private connectionManager = getDatabaseConnectionManager();
  private errorLogger = getComprehensiveErrorLogger();
  private resilientLogger = getResilientLogger();

  /**
   * Perform comprehensive startup validation
   */
  async performStartupValidation(): Promise<StartupValidationResult> {
    const startTime = Date.now();
    const correlationId = `startup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🚀 Starting comprehensive system validation (${correlationId})...`);

    const result: StartupValidationResult = {
      success: true,
      databaseHealth: { isHealthy: false, connectionTime: 0 },
      schemaValidation: { isValid: false, missingTables: [], structureIssues: [], recommendations: [] },
      systemChecks: [],
      repairRecommendations: [],
      warnings: [],
      criticalIssues: [],
      startupTime: 0
    };

    try {
      // 1. Database Health Check
      console.log("🔍 Checking database health...");
      result.databaseHealth = await this.checkDatabaseHealth(correlationId);
      
      if (!result.databaseHealth.isHealthy) {
        result.success = false;
        result.criticalIssues.push(`Database health check failed: ${result.databaseHealth.error}`);
        
        result.repairRecommendations.push({
          issue: 'Database Connection Failed',
          severity: 'CRITICAL',
          category: 'DATABASE',
          description: 'Cannot establish connection to database',
          automaticRepair: false,
          repairSteps: [
            'Check database server status',
            'Verify connection string in environment variables',
            'Check network connectivity',
            'Verify database credentials',
            'Check firewall settings'
          ],
          estimatedTime: '5-30 minutes',
          riskLevel: 'LOW'
        });
      }

      // 2. Schema Validation
      if (result.databaseHealth.isHealthy) {
        console.log("🔍 Validating database schema...");
        result.schemaValidation = await this.validateSchema(correlationId);
        
        if (!result.schemaValidation.isValid) {
          result.success = false;
          result.criticalIssues.push('Database schema validation failed');
          
          // Generate repair recommendations for schema issues
          result.repairRecommendations.push(...this.generateSchemaRepairRecommendations(result.schemaValidation));
        }
      }

      // 3. System Checks
      console.log("🔍 Performing system checks...");
      result.systemChecks = await this.performSystemChecks(correlationId);
      
      // Check for critical system issues
      const criticalSystemIssues = result.systemChecks.filter(check => 
        !check.success && check.severity === 'CRITICAL'
      );
      
      if (criticalSystemIssues.length > 0) {
        result.success = false;
        result.criticalIssues.push(...criticalSystemIssues.map(issue => issue.message));
      }

      // Collect warnings
      const warnings = result.systemChecks.filter(check => 
        check.severity === 'WARNING'
      );
      result.warnings.push(...warnings.map(warning => warning.message));

      // 4. Generate additional repair recommendations
      result.repairRecommendations.push(...this.generateSystemRepairRecommendations(result.systemChecks));

      // 5. Final validation
      result.startupTime = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ Startup validation completed successfully in ${result.startupTime}ms`);
      } else {
        console.error(`❌ Startup validation failed with ${result.criticalIssues.length} critical issues`);
        console.error('Critical Issues:', result.criticalIssues);
        console.error('Repair Recommendations:', result.repairRecommendations.length);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown startup validation error';
      
      await logErrorWithContext(
        error instanceof Error ? error : new Error(errorMessage),
        'startup_validation',
        {
          correlationId,
          severity: 'CRITICAL',
          category: 'SYSTEM'
        }
      );

      result.success = false;
      result.criticalIssues.push(`Startup validation error: ${errorMessage}`);
      result.startupTime = Date.now() - startTime;
      
      return result;
    }
  }

  /**
   * Check database health with detailed diagnostics
   */
  private async checkDatabaseHealth(correlationId: string): Promise<DatabaseHealthCheck> {
    try {
      const startTime = Date.now();
      
      // Basic connection test
      await prisma.$queryRaw`SELECT 1 as health_check`;
      
      const connectionTime = Date.now() - startTime;
      
      // Additional health checks
      const details = await this.performDetailedDatabaseChecks();
      
      return {
        isHealthy: true,
        connectionTime,
        details
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database health check failed';
      
      await logErrorWithContext(
        error instanceof Error ? error : new Error(errorMessage),
        'database_health_check',
        {
          correlationId,
          severity: 'CRITICAL',
          category: 'DATABASE'
        }
      );

      return {
        isHealthy: false,
        connectionTime: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Perform detailed database checks
   */
  private async performDetailedDatabaseChecks(): Promise<DatabaseHealthCheck['details']> {
    const details: DatabaseHealthCheck['details'] = {
      canConnect: true,
      canRead: false,
      canWrite: false,
      tablesAccessible: [],
      tablesInaccessible: []
    };

    const testTables = ['BookingPlan', 'Employee', 'AssignmentLog'];

    // Test read access
    try {
      await prisma.bookingPlan.findFirst({ take: 1 });
      details.canRead = true;
    } catch (error) {
      console.warn('⚠️ Database read test failed:', error);
    }

    // Test write access (with rollback)
    try {
      await prisma.$transaction(async (tx) => {
        await tx.systemErrorLog.create({
          data: {
            operation: 'startup_write_test',
            errorName: 'TEST',
            errorMessage: 'Startup write test - will be rolled back',
            systemState: { test: true },
            additionalData: { test: true }
          }
        });
        
        // Rollback by throwing error
        throw new Error('Intentional rollback for write test');
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Intentional rollback')) {
        details.canWrite = true;
      } else {
        console.warn('⚠️ Database write test failed:', error);
      }
    }

    // Test table accessibility
    for (const tableName of testTables) {
      try {
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
        }
        details.tablesAccessible.push(tableName);
      } catch (error) {
        details.tablesInaccessible.push(tableName);
        console.warn(`⚠️ Table ${tableName} not accessible:`, error);
      }
    }

    return details;
  }

  /**
   * Validate database schema
   */
  private async validateSchema(correlationId: string): Promise<ValidationResult> {
    try {
      return await SchemaValidator.validateRequiredTables();
    } catch (error) {
      await logErrorWithContext(
        error instanceof Error ? error : new Error('Schema validation failed'),
        'schema_validation',
        {
          correlationId,
          severity: 'HIGH',
          category: 'DATABASE'
        }
      );

      return {
        isValid: false,
        missingTables: [],
        structureIssues: [{
          table: 'UNKNOWN',
          issue: error instanceof Error ? error.message : 'Schema validation error',
          severity: 'error'
        }],
        recommendations: ['Check database schema and run migrations']
      };
    }
  }

  /**
   * Perform comprehensive system checks
   */
  private async performSystemChecks(correlationId: string): Promise<SystemCheckResult[]> {
    const checks: SystemCheckResult[] = [];

    // Memory check
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
    
    checks.push({
      name: 'Memory Usage',
      success: memoryUsageMB < 512, // Warning if over 512MB
      message: `Heap memory usage: ${memoryUsageMB.toFixed(2)}MB`,
      details: memoryUsage,
      severity: memoryUsageMB > 1024 ? 'ERROR' : memoryUsageMB > 512 ? 'WARNING' : 'INFO'
    });

    // Node.js version check
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    checks.push({
      name: 'Node.js Version',
      success: majorVersion >= 18,
      message: `Node.js version: ${nodeVersion}`,
      details: { version: nodeVersion, majorVersion },
      severity: majorVersion < 16 ? 'CRITICAL' : majorVersion < 18 ? 'WARNING' : 'INFO'
    });

    // Environment variables check
    const requiredEnvVars = ['DATABASE_URL'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    checks.push({
      name: 'Environment Variables',
      success: missingEnvVars.length === 0,
      message: missingEnvVars.length === 0 
        ? 'All required environment variables are set'
        : `Missing environment variables: ${missingEnvVars.join(', ')}`,
      details: { required: requiredEnvVars, missing: missingEnvVars },
      severity: missingEnvVars.length > 0 ? 'CRITICAL' : 'INFO'
    });

    // Disk space check (if available)
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      checks.push({
        name: 'File System Access',
        success: true,
        message: 'File system is accessible',
        details: { accessible: true },
        severity: 'INFO'
      });
    } catch (error) {
      checks.push({
        name: 'File System Access',
        success: false,
        message: 'File system access failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'ERROR'
      });
    }

    // Logging system check
    try {
      const loggerHealth = this.resilientLogger.getHealthStatus();
      
      checks.push({
        name: 'Logging System',
        success: loggerHealth.isHealthy,
        message: loggerHealth.isHealthy 
          ? 'Logging system is healthy'
          : 'Logging system is unhealthy',
        details: loggerHealth,
        severity: loggerHealth.isHealthy ? 'INFO' : 'WARNING'
      });
    } catch (error) {
      checks.push({
        name: 'Logging System',
        success: false,
        message: 'Logging system check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'ERROR'
      });
    }

    // Connection manager check
    try {
      const connectionHealth = this.connectionManager.getConnectionHealth();
      
      checks.push({
        name: 'Connection Manager',
        success: connectionHealth.isConnected,
        message: connectionHealth.isConnected 
          ? `Connection manager healthy (${connectionHealth.connectionTime}ms)`
          : `Connection manager unhealthy: ${connectionHealth.error}`,
        details: connectionHealth,
        severity: connectionHealth.isConnected ? 'INFO' : 'ERROR'
      });
    } catch (error) {
      checks.push({
        name: 'Connection Manager',
        success: false,
        message: 'Connection manager check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'ERROR'
      });
    }

    return checks;
  }

  /**
   * Generate schema repair recommendations
   */
  private generateSchemaRepairRecommendations(schemaValidation: ValidationResult): RepairRecommendation[] {
    const recommendations: RepairRecommendation[] = [];

    // Missing tables
    if (schemaValidation.missingTables.length > 0) {
      recommendations.push({
        issue: `Missing Database Tables: ${schemaValidation.missingTables.join(', ')}`,
        severity: 'CRITICAL',
        category: 'SCHEMA',
        description: 'Required database tables are missing and need to be created',
        automaticRepair: false,
        repairSteps: [
          'Run database migrations: npx prisma migrate deploy',
          'If migrations fail, check migration files in prisma/migrations/',
          'Consider running: npx prisma db push (for development only)',
          'Verify database user has CREATE TABLE permissions'
        ],
        estimatedTime: '2-10 minutes',
        riskLevel: 'LOW'
      });
    }

    // Structure issues
    const criticalStructureIssues = schemaValidation.structureIssues.filter(issue => issue.severity === 'error');
    if (criticalStructureIssues.length > 0) {
      recommendations.push({
        issue: `Database Structure Issues: ${criticalStructureIssues.length} critical issues found`,
        severity: 'HIGH',
        category: 'SCHEMA',
        description: 'Database table structures do not match expected schema',
        automaticRepair: false,
        repairSteps: [
          'Review database schema differences',
          'Run: npx prisma db pull to sync schema with database',
          'Run: npx prisma generate to update Prisma client',
          'Consider creating a new migration if schema changes are needed'
        ],
        estimatedTime: '10-30 minutes',
        riskLevel: 'MEDIUM'
      });
    }

    return recommendations;
  }

  /**
   * Generate system repair recommendations
   */
  private generateSystemRepairRecommendations(systemChecks: SystemCheckResult[]): RepairRecommendation[] {
    const recommendations: RepairRecommendation[] = [];

    // Memory issues
    const memoryCheck = systemChecks.find(check => check.name === 'Memory Usage');
    if (memoryCheck && !memoryCheck.success) {
      recommendations.push({
        issue: 'High Memory Usage',
        severity: memoryCheck.severity === 'ERROR' ? 'HIGH' : 'MEDIUM',
        category: 'SYSTEM',
        description: 'Application is using excessive memory',
        automaticRepair: false,
        repairSteps: [
          'Monitor memory usage over time',
          'Check for memory leaks in application code',
          'Consider increasing server memory allocation',
          'Review and optimize database queries',
          'Implement memory usage monitoring'
        ],
        estimatedTime: '30-120 minutes',
        riskLevel: 'LOW'
      });
    }

    // Node.js version issues
    const nodeCheck = systemChecks.find(check => check.name === 'Node.js Version');
    if (nodeCheck && !nodeCheck.success) {
      recommendations.push({
        issue: 'Outdated Node.js Version',
        severity: nodeCheck.severity === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM',
        category: 'SYSTEM',
        description: 'Node.js version is outdated and may have security or compatibility issues',
        automaticRepair: false,
        repairSteps: [
          'Update Node.js to version 18 or higher',
          'Use Node Version Manager (nvm) for easy version management',
          'Test application thoroughly after Node.js upgrade',
          'Update package.json engines field to specify minimum Node.js version'
        ],
        estimatedTime: '15-60 minutes',
        riskLevel: 'MEDIUM'
      });
    }

    // Environment variable issues
    const envCheck = systemChecks.find(check => check.name === 'Environment Variables');
    if (envCheck && !envCheck.success) {
      recommendations.push({
        issue: 'Missing Environment Variables',
        severity: 'CRITICAL',
        category: 'CONFIGURATION',
        description: 'Required environment variables are not set',
        automaticRepair: false,
        repairSteps: [
          'Create or update .env file with required variables',
          'Check .env.example for reference',
          'Verify environment variables in production deployment',
          'Ensure sensitive variables are properly secured'
        ],
        estimatedTime: '5-15 minutes',
        riskLevel: 'LOW'
      });
    }

    return recommendations;
  }

  /**
   * Attempt automatic repairs where possible
   */
  async attemptAutomaticRepairs(recommendations: RepairRecommendation[]): Promise<RepairAttemptResult[]> {
    const results: RepairAttemptResult[] = [];

    for (const recommendation of recommendations) {
      if (!recommendation.automaticRepair) {
        results.push({
          recommendation: recommendation.issue,
          attempted: false,
          success: false,
          message: 'Automatic repair not available for this issue'
        });
        continue;
      }

      try {
        console.log(`🔧 Attempting automatic repair: ${recommendation.issue}`);
        
        // Implement specific repair logic here
        // For now, we'll just mark as attempted but not successful
        
        results.push({
          recommendation: recommendation.issue,
          attempted: true,
          success: false,
          message: 'Automatic repair logic not yet implemented'
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown repair error';
        
        results.push({
          recommendation: recommendation.issue,
          attempted: true,
          success: false,
          message: `Repair failed: ${errorMessage}`
        });
      }
    }

    return results;
  }
}

// Type definitions
export interface RepairAttemptResult {
  recommendation: string;
  attempted: boolean;
  success: boolean;
  message: string;
}

/**
 * Convenience function to perform startup validation
 */
export async function performStartupValidation(): Promise<StartupValidationResult> {
  const validator = new StartupValidator();
  return await validator.performStartupValidation();
}

/**
 * Convenience function to validate system health
 */
export async function validateSystemHealth(): Promise<boolean> {
  try {
    const result = await performStartupValidation();
    return result.success;
  } catch (error) {
    console.error('❌ System health validation failed:', error);
    return false;
  }
}