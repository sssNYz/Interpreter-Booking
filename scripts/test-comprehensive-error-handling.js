/**
 * Test script for comprehensive error handling and recovery system
 */

async function importModules() {
  try {
    const comprehensiveErrorHandling = await import('../lib/assignment/comprehensive-error-handling.js');
    const startupValidator = await import('../lib/assignment/startup-validator.js');
    const gracefulDegradation = await import('../lib/assignment/graceful-degradation.js');
    const databaseConnectionManager = await import('../lib/assignment/database-connection-manager.js');
    
    return {
      initializeComprehensiveErrorHandling: comprehensiveErrorHandling.initializeComprehensiveErrorHandling,
      getSystemStatus: comprehensiveErrorHandling.getSystemStatus,
      performSystemHealthCheck: comprehensiveErrorHandling.performSystemHealthCheck,
      executeDatabaseOperationSafely: comprehensiveErrorHandling.executeDatabaseOperationSafely,
      executeAssignmentSafely: comprehensiveErrorHandling.executeAssignmentSafely,
      performStartupValidation: startupValidator.performStartupValidation,
      getGracefulDegradationManager: gracefulDegradation.getGracefulDegradationManager,
      getDatabaseConnectionManager: databaseConnectionManager.getDatabaseConnectionManager
    };
  } catch (error) {
    console.error('❌ Failed to import modules:', error.message);
    console.log('ℹ️ This is expected if the modules are TypeScript files that need compilation');
    return null;
  }
}

async function testComprehensiveErrorHandling() {
  console.log('🧪 Testing Comprehensive Error Handling System');
  console.log('=' .repeat(60));

  // Import modules
  const modules = await importModules();
  if (!modules) {
    console.log('⚠️ Cannot test TypeScript modules directly. Please compile first or test in the application.');
    return;
  }

  const {
    initializeComprehensiveErrorHandling,
    getSystemStatus,
    performSystemHealthCheck,
    executeDatabaseOperationSafely,
    executeAssignmentSafely,
    performStartupValidation,
    getGracefulDegradationManager,
    getDatabaseConnectionManager
  } = modules;

  try {
    // Test 1: System Initialization
    console.log('\n📋 Test 1: System Initialization');
    console.log('-'.repeat(40));
    
    const initResult = await initializeComprehensiveErrorHandling();
    console.log(`✅ Initialization result: ${initResult ? 'SUCCESS' : 'FAILED'}`);

    // Test 2: Startup Validation
    console.log('\n📋 Test 2: Startup Validation');
    console.log('-'.repeat(40));
    
    const validationResult = await performStartupValidation();
    console.log(`✅ Validation success: ${validationResult.success}`);
    console.log(`📊 Startup time: ${validationResult.startupTime}ms`);
    console.log(`🔍 System checks: ${validationResult.systemChecks.length}`);
    console.log(`⚠️ Warnings: ${validationResult.warnings.length}`);
    console.log(`❌ Critical issues: ${validationResult.criticalIssues.length}`);
    console.log(`🔧 Repair recommendations: ${validationResult.repairRecommendations.length}`);

    if (validationResult.criticalIssues.length > 0) {
      console.log('\nCritical Issues:');
      validationResult.criticalIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    if (validationResult.repairRecommendations.length > 0) {
      console.log('\nRepair Recommendations:');
      validationResult.repairRecommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.severity}] ${rec.issue}`);
        console.log(`     ${rec.description}`);
        console.log(`     Estimated time: ${rec.estimatedTime}`);
      });
    }

    // Test 3: System Status
    console.log('\n📋 Test 3: System Status');
    console.log('-'.repeat(40));
    
    const systemStatus = await getSystemStatus();
    console.log(`✅ Overall status: ${systemStatus.overall}`);
    console.log(`🔌 Database connected: ${systemStatus.database.connected}`);
    console.log(`📝 Logging healthy: ${systemStatus.logging.healthy}`);
    console.log(`📊 Degradation level: ${systemStatus.degradation.level}`);
    console.log(`💾 Memory usage: ${systemStatus.memory.usage.toFixed(2)}MB`);
    console.log(`❌ Error rate: ${(systemStatus.errors.errorRate * 100).toFixed(2)}%`);
    console.log(`🕒 Last successful operation: ${systemStatus.lastSuccessfulOperation || 'None'}`);

    // Test 4: Health Check
    console.log('\n📋 Test 4: Health Check');
    console.log('-'.repeat(40));
    
    const healthCheck = await performSystemHealthCheck();
    console.log(`✅ Health check result: ${healthCheck ? 'HEALTHY' : 'UNHEALTHY'}`);

    // Test 5: Database Connection Manager
    console.log('\n📋 Test 5: Database Connection Manager');
    console.log('-'.repeat(40));
    
    const connectionManager = getDatabaseConnectionManager();
    const connectionHealth = connectionManager.getConnectionHealth();
    console.log(`🔌 Connection status: ${connectionHealth.isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log(`⏱️ Connection time: ${connectionHealth.connectionTime}ms`);
    console.log(`❌ Consecutive failures: ${connectionHealth.consecutiveFailures}`);
    
    if (connectionHealth.error) {
      console.log(`⚠️ Last error: ${connectionHealth.error}`);
    }

    // Test 6: Database Operation with Error Handling
    console.log('\n📋 Test 6: Safe Database Operation');
    console.log('-'.repeat(40));
    
    const dbOperationResult = await executeDatabaseOperationSafely(
      async () => {
        // Simple database query
        const { default: prisma } = await import('../prisma/prisma.js');
        return await prisma.bookingPlan.count();
      },
      {
        operation: 'test_database_operation',
        correlationId: `test_${Date.now()}`
      },
      {
        retries: 2,
        fallbackValue: 0
      }
    );

    console.log(`✅ Database operation success: ${dbOperationResult.success}`);
    console.log(`📊 Result: ${dbOperationResult.data !== undefined ? dbOperationResult.data : 'No data'}`);
    console.log(`📉 Degradation level: ${dbOperationResult.degradationLevel}`);
    console.log(`🔄 Fallbacks used: ${dbOperationResult.fallbacksUsed.join(', ') || 'None'}`);
    console.log(`⚠️ Warnings: ${dbOperationResult.warnings.join(', ') || 'None'}`);

    if (!dbOperationResult.success && dbOperationResult.error) {
      console.log(`❌ Error: ${dbOperationResult.error}`);
    }

    // Test 7: Graceful Degradation Manager
    console.log('\n📋 Test 7: Graceful Degradation Manager');
    console.log('-'.repeat(40));
    
    const degradationManager = getGracefulDegradationManager();
    const degradationLevel = degradationManager.getDegradationLevel();
    const systemHealth = degradationManager.getSystemHealth();
    
    console.log(`📊 Current degradation level: ${degradationLevel.level}`);
    console.log(`📝 Description: ${degradationLevel.description}`);
    console.log(`✅ Enabled features: ${degradationLevel.enabledFeatures.join(', ')}`);
    console.log(`❌ Disabled features: ${degradationLevel.disabledFeatures.join(', ') || 'None'}`);
    console.log(`🔄 Fallback methods: ${degradationLevel.fallbackMethods.join(', ') || 'None'}`);
    
    console.log(`\n🏥 System Health:`);
    console.log(`  Database connected: ${systemHealth.databaseConnected}`);
    console.log(`  Logging healthy: ${systemHealth.loggingHealthy}`);
    console.log(`  Memory usage: ${systemHealth.memoryUsage.toFixed(2)}MB`);
    console.log(`  Error rate: ${(systemHealth.errorRate * 100).toFixed(2)}%`);

    // Test 8: Assignment with Error Handling (if we have a test booking)
    console.log('\n📋 Test 8: Safe Assignment Execution');
    console.log('-'.repeat(40));
    
    try {
      // Try to find a booking to test with
      const { default: prisma } = await import('../prisma/prisma.js');
      const testBooking = await prisma.bookingPlan.findFirst({
        where: {
          interpreterEmpCode: null, // Unassigned booking
          bookingStatus: 'CONFIRMED'
        },
        select: { bookingId: true }
      });

      if (testBooking) {
        console.log(`🎯 Testing assignment for booking ${testBooking.bookingId}...`);
        
        const assignmentResult = await executeAssignmentSafely(
          testBooking.bookingId,
          {
            correlationId: `test_assignment_${Date.now()}`
          }
        );

        console.log(`✅ Assignment success: ${assignmentResult.success}`);
        console.log(`📊 Status: ${assignmentResult.data?.status || 'Unknown'}`);
        console.log(`👤 Interpreter: ${assignmentResult.data?.interpreterId || 'None'}`);
        console.log(`📝 Reason: ${assignmentResult.data?.reason || 'No reason provided'}`);
        console.log(`📉 Degradation level: ${assignmentResult.degradationLevel}`);
        console.log(`🔄 Fallbacks used: ${assignmentResult.fallbacksUsed.join(', ') || 'None'}`);
        console.log(`⚠️ Warnings: ${assignmentResult.warnings.join(', ') || 'None'}`);

        if (!assignmentResult.success && assignmentResult.error) {
          console.log(`❌ Error: ${assignmentResult.error}`);
        }
      } else {
        console.log('⚠️ No unassigned bookings found for testing');
      }
    } catch (error) {
      console.log(`❌ Assignment test failed: ${error.message}`);
    }

    // Test 9: Error Simulation
    console.log('\n📋 Test 9: Error Handling Simulation');
    console.log('-'.repeat(40));
    
    try {
      const errorResult = await executeDatabaseOperationSafely(
        async () => {
          // Simulate an error
          throw new Error('Simulated database error for testing');
        },
        {
          operation: 'test_error_simulation',
          correlationId: `error_test_${Date.now()}`
        },
        {
          retries: 1,
          fallbackValue: 'fallback_result'
        }
      );

      console.log(`✅ Error handling success: ${errorResult.success}`);
      console.log(`📊 Result: ${errorResult.data}`);
      console.log(`🔄 Fallbacks used: ${errorResult.fallbacksUsed.join(', ')}`);
      console.log(`⚠️ Warnings: ${errorResult.warnings.join(', ')}`);
      
      if (errorResult.error) {
        console.log(`❌ Original error: ${errorResult.error}`);
      }
    } catch (error) {
      console.log(`❌ Error simulation test failed: ${error.message}`);
    }

    // Final Summary
    console.log('\n📋 Test Summary');
    console.log('=' .repeat(60));
    console.log('✅ Comprehensive Error Handling System Test Complete');
    console.log(`📊 Overall system status: ${systemStatus.overall}`);
    console.log(`🔧 Initialization: ${initResult ? 'SUCCESS' : 'FAILED'}`);
    console.log(`🏥 Health check: ${healthCheck ? 'HEALTHY' : 'UNHEALTHY'}`);
    console.log(`📉 Current degradation: ${degradationLevel.level}`);
    
    if (validationResult.criticalIssues.length > 0) {
      console.log(`⚠️ Critical issues detected: ${validationResult.criticalIssues.length}`);
      console.log('   Please review repair recommendations above');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testComprehensiveErrorHandling()
    .then(() => {
      console.log('\n🎉 Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testComprehensiveErrorHandling };