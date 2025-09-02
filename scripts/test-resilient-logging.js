/**
 * Test script for resilient logging system
 */

async function testResilientLogging() {
  console.log('🧪 Testing resilient logging system...');
  
  try {
    // Import the modules (using dynamic import for ES modules)
    const { SchemaValidator } = await import('../lib/assignment/schema-validator.js');
    const { ResilientLogger } = await import('../lib/assignment/resilient-logger.js');
    const { performStartupValidation } = await import('../lib/assignment/startup-validator.js');
    
    // Test 1: Schema validation
    console.log('\n📋 Test 1: Schema validation');
    const schemaValidation = await SchemaValidator.validateRequiredTables();
    console.log('Schema validation result:', {
      isValid: schemaValidation.isValid,
      missingTables: schemaValidation.missingTables,
      issueCount: schemaValidation.structureIssues.length
    });
    
    // Test 2: Database health check
    console.log('\n📋 Test 2: Database health check');
    const healthCheck = await SchemaValidator.checkDatabaseHealth();
    console.log('Health check result:', {
      isHealthy: healthCheck.isHealthy,
      connectionTime: healthCheck.connectionTime,
      error: healthCheck.error
    });
    
    // Test 3: Resilient logger initialization
    console.log('\n📋 Test 3: Resilient logger initialization');
    const resilientLogger = ResilientLogger.getInstance();
    const loggerHealth = resilientLogger.getHealthStatus();
    console.log('Logger health:', {
      isHealthy: loggerHealth.isHealthy,
      lastHealthCheck: loggerHealth.lastHealthCheck,
      uptime: loggerHealth.uptime
    });
    
    // Test 4: Startup validation
    console.log('\n📋 Test 4: Comprehensive startup validation');
    const startupResult = await performStartupValidation();
    console.log('Startup validation result:', {
      success: startupResult.success,
      schemaValid: startupResult.schemaValid,
      loggingInitialized: startupResult.loggingInitialized,
      errorCount: startupResult.errors.length,
      warningCount: startupResult.warnings.length
    });
    
    if (startupResult.errors.length > 0) {
      console.log('Errors:', startupResult.errors);
    }
    if (startupResult.warnings.length > 0) {
      console.log('Warnings:', startupResult.warnings);
    }
    if (startupResult.recommendations.length > 0) {
      console.log('Recommendations:', startupResult.recommendations);
    }
    
    console.log('\n🎉 Resilient logging system tests completed!');
    
  } catch (error) {
    console.error('❌ Error during resilient logging tests:', error);
    
    // Fallback test using CommonJS approach
    console.log('\n⚠️ Attempting fallback test...');
    try {
      // Test basic database connectivity as fallback
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      await prisma.$queryRaw`SELECT 1 as test`;
      console.log('✅ Basic database connectivity confirmed');
      
      await prisma.$disconnect();
    } catch (fallbackError) {
      console.error('❌ Fallback test also failed:', fallbackError);
    }
  }
}

// Run the test
testResilientLogging().catch(console.error);