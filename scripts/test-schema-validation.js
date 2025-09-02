/**
 * Test script for database schema validation and logging fixes
 */

const { PrismaClient } = require('@prisma/client');

async function testSchemaValidation() {
  console.log('🧪 Testing database schema validation and logging fixes...');
  
  const prisma = new PrismaClient();
  
  try {
    // Test 1: Basic database connectivity
    console.log('\n📋 Test 1: Database connectivity');
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1 as test`;
    const connectionTime = Date.now() - startTime;
    console.log(`✅ Database connection successful (${connectionTime}ms)`);
    
    // Test 2: Test each required table access
    console.log('\n📋 Test 2: Required table access');
    
    const tables = [
      { name: 'AssignmentLog', model: prisma.assignmentLog },
      { name: 'ConflictDetectionLog', model: prisma.conflictDetectionLog },
      { name: 'DRPolicyLog', model: prisma.dRPolicyLog },
      { name: 'PoolProcessingLog', model: prisma.poolProcessingLog },
      { name: 'SystemErrorLog', model: prisma.systemErrorLog }
    ];
    
    for (const table of tables) {
      try {
        await table.model.findFirst({ take: 1 });
        console.log(`✅ ${table.name} table accessible`);
      } catch (error) {
        console.log(`❌ ${table.name} table error:`, error.message);
      }
    }
    
    // Test 3: Test JSON field structure for AssignmentLog
    console.log('\n📋 Test 3: AssignmentLog JSON fields');
    try {
      const testLog = await prisma.assignmentLog.findFirst({
        select: {
          id: true,
          bookingId: true,
          conflictDetection: true,
          drPolicyDecision: true,
          performance: true,
          poolProcessing: true,
          systemState: true
        },
        take: 1
      });
      console.log('✅ AssignmentLog JSON fields accessible');
      if (testLog) {
        console.log('   Sample data structure:', {
          hasConflictDetection: !!testLog.conflictDetection,
          hasDrPolicyDecision: !!testLog.drPolicyDecision,
          hasPerformance: !!testLog.performance,
          hasPoolProcessing: !!testLog.poolProcessing,
          hasSystemState: !!testLog.systemState
        });
      }
    } catch (error) {
      console.log('❌ AssignmentLog JSON fields error:', error.message);
    }
    
    // Test 4: Test creating a sample system error log
    console.log('\n📋 Test 4: System error logging');
    try {
      const testError = await prisma.systemErrorLog.create({
        data: {
          operation: 'test-schema-validation',
          errorName: 'TestError',
          errorMessage: 'This is a test error for schema validation',
          systemState: {
            timestamp: new Date().toISOString(),
            testMode: true
          },
          additionalData: {
            testRun: true,
            validationStep: 'schema-test'
          }
        }
      });
      console.log(`✅ System error log created successfully (ID: ${testError.id})`);
      
      // Clean up test record
      await prisma.systemErrorLog.delete({
        where: { id: testError.id }
      });
      console.log('✅ Test record cleaned up');
      
    } catch (error) {
      console.log('❌ System error logging test failed:', error.message);
    }
    
    // Test 5: Test creating a sample conflict detection log
    console.log('\n📋 Test 5: Conflict detection logging');
    try {
      // First, get a sample booking ID
      const sampleBooking = await prisma.bookingPlan.findFirst({
        select: { bookingId: true },
        take: 1
      });
      
      if (sampleBooking) {
        const testConflictLog = await prisma.conflictDetectionLog.create({
          data: {
            bookingId: sampleBooking.bookingId,
            timestamp: new Date(),
            requestedTimeStart: new Date(),
            requestedTimeEnd: new Date(Date.now() + 3600000), // 1 hour later
            totalInterpretersChecked: 5,
            availableInterpreters: 3,
            conflictedInterpreters: 2,
            conflicts: [
              {
                interpreterId: 'test-interpreter-1',
                conflictingBookingId: 999999,
                conflictType: 'OVERLAP',
                conflictStart: new Date(),
                conflictEnd: new Date(Date.now() + 1800000),
                meetingType: 'DR'
              }
            ],
            processingTimeMs: 150,
            resolutionStrategy: 'FILTER_CONFLICTS',
            outcome: 'SUCCESS'
          }
        });
        console.log(`✅ Conflict detection log created successfully (ID: ${testConflictLog.id})`);
        
        // Clean up test record
        await prisma.conflictDetectionLog.delete({
          where: { id: testConflictLog.id }
        });
        console.log('✅ Test conflict log cleaned up');
      } else {
        console.log('⚠️ No sample booking found, skipping conflict log test');
      }
      
    } catch (error) {
      console.log('❌ Conflict detection logging test failed:', error.message);
    }
    
    // Test 6: Test DR policy logging
    console.log('\n📋 Test 6: DR policy logging');
    try {
      const sampleBooking = await prisma.bookingPlan.findFirst({
        select: { bookingId: true },
        take: 1
      });
      
      if (sampleBooking) {
        const testDRLog = await prisma.dRPolicyLog.create({
          data: {
            bookingId: sampleBooking.bookingId,
            interpreterId: 'test-interpreter-1',
            timestamp: new Date(),
            isDRMeeting: true,
            drType: 'DR-I',
            mode: 'BALANCE',
            policyApplied: {
              allowConsecutiveDR: false,
              maxConsecutiveDR: 2,
              penaltyAmount: -0.7
            },
            lastGlobalDR: {
              interpreterId: 'test-interpreter-2',
              timeStart: new Date(Date.now() - 86400000), // 1 day ago
              bookingId: 999998
            },
            drHistory: {
              consecutiveCount: 1,
              isBlocked: false,
              penaltyApplied: true,
              penaltyAmount: -0.7,
              overrideApplied: false,
              policyDecisionReason: 'Standard DR policy applied'
            },
            alternativeInterpreters: 3,
            finalDecision: 'PENALIZED',
            decisionRationale: 'DR policy (BALANCE mode): Standard assignment with penalty'
          }
        });
        console.log(`✅ DR policy log created successfully (ID: ${testDRLog.id})`);
        
        // Clean up test record
        await prisma.dRPolicyLog.delete({
          where: { id: testDRLog.id }
        });
        console.log('✅ Test DR policy log cleaned up');
      } else {
        console.log('⚠️ No sample booking found, skipping DR policy log test');
      }
      
    } catch (error) {
      console.log('❌ DR policy logging test failed:', error.message);
    }
    
    console.log('\n🎉 Schema validation tests completed!');
    
  } catch (error) {
    console.error('❌ Critical error during schema validation tests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSchemaValidation().catch(console.error);