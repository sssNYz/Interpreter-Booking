/**
 * Integration test for logging system with assignment operations
 */

const { PrismaClient } = require('@prisma/client');

async function testLoggingIntegration() {
  console.log('🧪 Testing logging system integration...');
  
  const prisma = new PrismaClient();
  
  try {
    // Test 1: Create a sample assignment log with all enhanced fields
    console.log('\n📋 Test 1: Enhanced assignment logging');
    
    // Get a sample booking and interpreter
    const sampleBooking = await prisma.bookingPlan.findFirst({
      select: { bookingId: true },
      take: 1
    });
    
    const sampleInterpreter = await prisma.employee.findFirst({
      select: { empCode: true },
      take: 1
    });
    
    if (!sampleBooking || !sampleInterpreter) {
      console.log('⚠️ No sample booking or interpreter found, skipping integration test');
      return;
    }
    
    const testAssignmentLog = await prisma.assignmentLog.create({
      data: {
        bookingId: sampleBooking.bookingId,
        interpreterEmpCode: sampleInterpreter.empCode,
        status: 'assigned',
        reason: 'Test assignment with enhanced logging',
        preHoursSnapshot: {
          'interpreter-1': 10,
          'interpreter-2': 8,
          'interpreter-3': 12
        },
        postHoursSnapshot: {
          'interpreter-1': 11,
          'interpreter-2': 8,
          'interpreter-3': 12
        },
        scoreBreakdown: {
          fairnessScore: 0.85,
          urgencyScore: 0.6,
          lrsScore: 0.9,
          totalScore: 0.78
        },
        maxGapHours: 10,
        fairnessWindowDays: 30,
        // Enhanced fields
        conflictDetection: {
          totalInterpretersChecked: 5,
          availableInterpreters: 3,
          conflictedInterpreters: 2,
          conflictDetails: [
            {
              interpreterId: 'interpreter-2',
              conflictCount: 1,
              conflictTypes: ['OVERLAP']
            }
          ],
          processingTimeMs: 150
        },
        drPolicyDecision: {
          isDRMeeting: true,
          drType: 'DR-I',
          policyApplied: {
            allowConsecutiveDR: false,
            maxConsecutiveDR: 2,
            penaltyAmount: -0.7
          },
          interpreterDRHistory: {
            interpreterId: 'test-interpreter-1',
            consecutiveCount: 1,
            isBlocked: false,
            penaltyApplied: true,
            penaltyAmount: -0.7,
            overrideApplied: false
          },
          alternativeInterpreters: 2,
          policyDecisionReason: 'Standard DR policy applied with penalty'
        },
        poolProcessing: {
          wasPooled: true,
          poolMode: 'BALANCE',
          thresholdDays: 3,
          deadlineTime: new Date(Date.now() + 86400000 * 7), // 7 days from now
          batchId: 'test-batch-123',
          batchSize: 5,
          processingPriority: 2,
          fairnessImprovement: 0.15
        },
        performance: {
          totalProcessingTimeMs: 450,
          conflictCheckTimeMs: 150,
          scoringTimeMs: 200,
          dbOperationTimeMs: 100,
          retryAttempts: 0
        },
        systemState: {
          activeInterpreters: 15,
          poolSize: 8,
          systemLoad: 'MEDIUM',
          concurrentAssignments: 2
        }
      }
    });
    
    console.log(`✅ Enhanced assignment log created successfully (ID: ${testAssignmentLog.id})`);
    
    // Verify the data was stored correctly
    const retrievedLog = await prisma.assignmentLog.findUnique({
      where: { id: testAssignmentLog.id },
      select: {
        id: true,
        bookingId: true,
        status: true,
        conflictDetection: true,
        drPolicyDecision: true,
        poolProcessing: true,
        performance: true,
        systemState: true
      }
    });
    
    console.log('✅ Enhanced fields verification:', {
      hasConflictDetection: !!retrievedLog?.conflictDetection,
      hasDrPolicyDecision: !!retrievedLog?.drPolicyDecision,
      hasPoolProcessing: !!retrievedLog?.poolProcessing,
      hasPerformance: !!retrievedLog?.performance,
      hasSystemState: !!retrievedLog?.systemState
    });
    
    // Test 2: Test error handling with invalid data
    console.log('\n📋 Test 2: Error handling test');
    try {
      await prisma.assignmentLog.create({
        data: {
          bookingId: -1, // Invalid booking ID
          interpreterEmpCode: null,
          status: 'test-invalid',
          reason: 'This should fail gracefully',
          preHoursSnapshot: {},
          maxGapHours: 10,
          fairnessWindowDays: 30
        }
      });
      console.log('⚠️ Invalid data was accepted (unexpected)');
    } catch (error) {
      console.log('✅ Error handling working correctly:', error.message.substring(0, 100) + '...');
    }
    
    // Test 3: Test buffer-like operations (simulate multiple rapid inserts)
    console.log('\n📋 Test 3: Rapid logging simulation');
    const rapidLogs = [];
    const startTime = Date.now();
    
    for (let i = 0; i < 5; i++) {
      try {
        const log = await prisma.assignmentLog.create({
          data: {
            bookingId: sampleBooking.bookingId,
            interpreterEmpCode: sampleInterpreter.empCode,
            status: 'assigned',
            reason: `Rapid test log ${i}`,
            preHoursSnapshot: { [`interpreter-${i}`]: i * 2 },
            postHoursSnapshot: { [`interpreter-${i}`]: i * 2 + 1 },
            maxGapHours: 10,
            fairnessWindowDays: 30,
            performance: {
              totalProcessingTimeMs: 100 + i * 10,
              conflictCheckTimeMs: 50,
              scoringTimeMs: 30,
              dbOperationTimeMs: 20
            }
          }
        });
        rapidLogs.push(log.id);
      } catch (error) {
        console.log(`⚠️ Rapid log ${i} failed:`, error.message);
      }
    }
    
    const endTime = Date.now();
    console.log(`✅ Created ${rapidLogs.length} rapid logs in ${endTime - startTime}ms`);
    
    // Clean up test records
    console.log('\n🧹 Cleaning up test records...');
    
    // Delete the main test log
    await prisma.assignmentLog.delete({
      where: { id: testAssignmentLog.id }
    });
    
    // Delete rapid test logs
    if (rapidLogs.length > 0) {
      await prisma.assignmentLog.deleteMany({
        where: {
          id: {
            in: rapidLogs
          }
        }
      });
    }
    
    console.log('✅ Test records cleaned up');
    
    console.log('\n🎉 Logging integration tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during logging integration tests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testLoggingIntegration().catch(console.error);