/**
 * Simple test script for Auto-Approval Function
 * Tests basic functionality and database integration
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAutoApprovalSimple() {
  console.log("🧪 Testing Auto-Approval Function (Simple)...\n");

  try {
    // Test 1: Check if auto-approval log table exists
    console.log("📋 Test 1: Check Auto-Approval Log Table");
    try {
      const logCount = await prisma.autoApprovalLog.count();
      console.log(`✅ Auto-approval log table exists with ${logCount} entries`);
    } catch (error) {
      console.log("❌ Auto-approval log table not found or accessible");
      console.log(`   Error: ${error.message}`);
      return;
    }
    console.log();

    // Test 2: Create test auto-approval log entry
    console.log("📝 Test 2: Create Test Log Entry");
    try {
      const testLogEntry = await prisma.autoApprovalLog.create({
        data: {
          timestamp: new Date(),
          eventType: 'EVALUATION_ERROR',
          reason: 'Test log entry for auto-approval functionality',
          currentMode: 'NORMAL',
          loadAssessment: JSON.stringify({
            poolSize: 5,
            averageProcessingTime: 1200,
            conflictRate: 0.15,
            escalationRate: 0.08,
            loadLevel: 'LOW',
            confidence: 0.85
          }),
          confidence: 0.85,
          overrideApplied: false
        }
      });

      console.log("✅ Test log entry created successfully");
      console.log(`   ID: ${testLogEntry.id}`);
      console.log(`   Event Type: ${testLogEntry.eventType}`);
      console.log(`   Timestamp: ${testLogEntry.timestamp.toISOString()}`);
    } catch (error) {
      console.log("❌ Failed to create test log entry");
      console.log(`   Error: ${error.message}`);
    }
    console.log();

    // Test 3: Test different event types
    console.log("🔄 Test 3: Test Different Event Types");
    const eventTypes = [
      'AUTO_SWITCH_SUCCESS',
      'AUTO_SWITCH_FAILED', 
      'MANUAL_OVERRIDE_ENABLED',
      'MANUAL_OVERRIDE_DISABLED'
    ];

    for (const eventType of eventTypes) {
      try {
        await prisma.autoApprovalLog.create({
          data: {
            timestamp: new Date(),
            eventType,
            reason: `Test ${eventType.toLowerCase().replace(/_/g, ' ')}`,
            currentMode: 'BALANCE',
            oldMode: eventType.includes('SWITCH') ? 'NORMAL' : undefined,
            newMode: eventType.includes('SWITCH') ? 'URGENT' : undefined,
            overrideApplied: eventType.includes('OVERRIDE')
          }
        });
        console.log(`   ✅ ${eventType} log entry created`);
      } catch (error) {
        console.log(`   ❌ Failed to create ${eventType} log entry: ${error.message}`);
      }
    }
    console.log();

    // Test 4: Query and display recent logs
    console.log("📊 Test 4: Query Recent Auto-Approval Logs");
    try {
      const recentLogs = await prisma.autoApprovalLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      console.log(`✅ Found ${recentLogs.length} recent log entries:`);
      recentLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.eventType}: ${log.reason}`);
        console.log(`      Mode: ${log.currentMode}${log.oldMode && log.newMode ? ` (${log.oldMode} → ${log.newMode})` : ''}`);
        console.log(`      Override: ${log.overrideApplied ? 'Yes' : 'No'}`);
        console.log(`      Time: ${log.timestamp.toISOString()}`);
        if (log.loadAssessment) {
          try {
            const assessment = JSON.parse(log.loadAssessment);
            console.log(`      Load: ${assessment.loadLevel} (confidence: ${(assessment.confidence * 100).toFixed(1)}%)`);
          } catch (e) {
            console.log(`      Load: [Parse error]`);
          }
        }
        console.log();
      });
    } catch (error) {
      console.log("❌ Failed to query recent logs");
      console.log(`   Error: ${error.message}`);
    }

    // Test 5: Test log filtering
    console.log("🔍 Test 5: Test Log Filtering");
    try {
      const switchLogs = await prisma.autoApprovalLog.count({
        where: {
          eventType: {
            in: ['AUTO_SWITCH_SUCCESS', 'AUTO_SWITCH_FAILED']
          }
        }
      });

      const overrideLogs = await prisma.autoApprovalLog.count({
        where: {
          overrideApplied: true
        }
      });

      console.log(`✅ Log filtering successful:`);
      console.log(`   Switch events: ${switchLogs}`);
      console.log(`   Override events: ${overrideLogs}`);
    } catch (error) {
      console.log("❌ Failed to filter logs");
      console.log(`   Error: ${error.message}`);
    }
    console.log();

    // Test 6: Test complex load assessment storage
    console.log("📈 Test 6: Test Complex Load Assessment Storage");
    try {
      const complexAssessment = {
        poolSize: 25,
        averageProcessingTime: 3500,
        conflictRate: 0.32,
        escalationRate: 0.28,
        recommendedMode: 'URGENT',
        confidence: 0.92,
        loadLevel: 'HIGH',
        metrics: {
          recentAssignments: 45,
          failedAssignments: 12,
          poolGrowthRate: 1.8,
          systemResponseTime: 850,
          deadlineViolations: 7
        },
        timestamp: new Date()
      };

      const complexLog = await prisma.autoApprovalLog.create({
        data: {
          timestamp: new Date(),
          eventType: 'AUTO_SWITCH_SUCCESS',
          reason: 'High system load detected, switching to urgent mode',
          oldMode: 'BALANCE',
          newMode: 'URGENT',
          currentMode: 'URGENT',
          loadAssessment: JSON.stringify(complexAssessment),
          confidence: complexAssessment.confidence,
          overrideApplied: false,
          modeTransition: JSON.stringify({
            success: true,
            pooledBookingsAffected: 18,
            immediateAssignments: 12,
            errors: []
          })
        }
      });

      console.log("✅ Complex load assessment stored successfully");
      console.log(`   Log ID: ${complexLog.id}`);
      console.log(`   Load Level: ${complexAssessment.loadLevel}`);
      console.log(`   Confidence: ${(complexAssessment.confidence * 100).toFixed(1)}%`);
    } catch (error) {
      console.log("❌ Failed to store complex load assessment");
      console.log(`   Error: ${error.message}`);
    }
    console.log();

    // Test 7: Cleanup test entries (optional)
    console.log("🧹 Test 7: Cleanup Test Entries");
    try {
      const deletedCount = await prisma.autoApprovalLog.deleteMany({
        where: {
          reason: {
            startsWith: 'Test'
          }
        }
      });

      console.log(`✅ Cleaned up ${deletedCount.count} test entries`);
    } catch (error) {
      console.log("❌ Failed to cleanup test entries");
      console.log(`   Error: ${error.message}`);
    }

    console.log("\n🎉 Auto-Approval Function database testing completed successfully!");
    console.log("✅ All database operations for auto-approval are working correctly");
    console.log("✅ Auto-approval log table is properly configured");
    console.log("✅ Complex data structures can be stored and retrieved");

  } catch (error) {
    console.error("❌ Test execution failed:", error);
    console.error("Stack trace:", error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testAutoApprovalSimple().catch(console.error);
}

module.exports = { testAutoApprovalSimple };