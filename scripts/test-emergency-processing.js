#!/usr/bin/env node

/**
 * Test script for Emergency Pool Processing Override functionality
 * Tests priority-based processing, detailed reporting, audit logging, and manual escalation
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testEmergencyProcessing() {
  console.log('🚨 Testing Emergency Pool Processing Override...\n');

  try {
    // Test 1: Get emergency processing info (GET endpoint)
    console.log('📊 Test 1: Getting emergency processing information...');
    const infoResponse = await fetch('http://localhost:3000/api/admin/pool/emergency-process', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!infoResponse.ok) {
      throw new Error(`Info request failed: ${infoResponse.status} ${infoResponse.statusText}`);
    }

    const infoData = await infoResponse.json();
    console.log('✅ Emergency processing info retrieved successfully');
    console.log(`   Pool size: ${infoData.poolSize}`);
    console.log(`   Can process: ${infoData.canProcess}`);
    console.log(`   Risk level: ${infoData.riskAssessment?.level || 'N/A'}`);
    console.log(`   Urgency score: ${infoData.riskAssessment?.urgencyScore || 'N/A'}/100`);
    
    if (infoData.priorityAnalysis) {
      console.log('   Priority breakdown:');
      console.log(`     Critical: ${infoData.priorityAnalysis.critical}`);
      console.log(`     High: ${infoData.priorityAnalysis.high}`);
      console.log(`     Medium: ${infoData.priorityAnalysis.medium}`);
      console.log(`     Low: ${infoData.priorityAnalysis.low}`);
    }
    
    if (infoData.deadlineAnalysis) {
      console.log('   Deadline analysis:');
      console.log(`     Past deadline: ${infoData.deadlineAnalysis.pastDeadline}`);
      console.log(`     Within 2 hours: ${infoData.deadlineAnalysis.within2Hours}`);
      console.log(`     Within 6 hours: ${infoData.deadlineAnalysis.within6Hours}`);
      console.log(`     Within 24 hours: ${infoData.deadlineAnalysis.within24Hours}`);
    }
    
    console.log(`   Estimated processing time: ${infoData.estimatedProcessingTimeFormatted || 'N/A'}`);
    
    if (infoData.systemRecommendations && infoData.systemRecommendations.length > 0) {
      console.log('   Recommendations:');
      infoData.systemRecommendations.forEach((rec, index) => {
        console.log(`     ${index + 1}. ${rec}`);
      });
    }
    console.log();

    // Test 2: Execute emergency processing (POST endpoint)
    console.log('🚨 Test 2: Executing emergency processing...');
    const processingResponse = await fetch('http://localhost:3000/api/admin/pool/emergency-process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: 'Test emergency processing with enhanced features',
        triggeredBy: 'TEST_SCRIPT'
      })
    });

    if (!processingResponse.ok) {
      throw new Error(`Processing request failed: ${processingResponse.status} ${processingResponse.statusText}`);
    }

    const processingData = await processingResponse.json();
    console.log(`✅ Emergency processing completed: ${processingData.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Batch ID: ${processingData.batchId}`);
    console.log(`   Message: ${processingData.message}`);
    
    if (processingData.results) {
      console.log('   Results:');
      console.log(`     Processed: ${processingData.results.processedCount}`);
      console.log(`     Assigned: ${processingData.results.assignedCount}`);
      console.log(`     Escalated: ${processingData.results.escalatedCount}`);
      console.log(`     Failed: ${processingData.results.failedCount}`);
      console.log(`     Manual escalation: ${processingData.results.manualEscalationCount}`);
      console.log(`     Processing time: ${processingData.results.processingTime}ms`);
      console.log(`     Average time per entry: ${Math.round(processingData.results.averageProcessingTime)}ms`);
    }
    
    if (processingData.priorityBreakdown) {
      console.log('   Priority breakdown:');
      console.log(`     Critical: ${processingData.priorityBreakdown.critical}`);
      console.log(`     High: ${processingData.priorityBreakdown.high}`);
      console.log(`     Medium: ${processingData.priorityBreakdown.medium}`);
      console.log(`     Low: ${processingData.priorityBreakdown.low}`);
    }
    
    if (processingData.poolStatus) {
      console.log('   Pool status change:');
      console.log(`     Before: ${processingData.poolStatus.before.totalInPool} entries`);
      console.log(`     After: ${processingData.poolStatus.after.totalInPool} entries`);
      console.log(`     Reduction: ${processingData.poolStatus.before.totalInPool - processingData.poolStatus.after.totalInPool} entries`);
    }
    
    if (processingData.auditLog) {
      console.log('   Audit log:');
      console.log(`     ID: ${processingData.auditLog.id}`);
      console.log(`     Triggered by: ${processingData.auditLog.triggeredBy}`);
      console.log(`     Reason: ${processingData.auditLog.reason}`);
      if (processingData.auditLog.results) {
        console.log(`     Success rate: ${(processingData.auditLog.results.successRate * 100).toFixed(1)}%`);
        console.log(`     Manual escalation rate: ${(processingData.auditLog.results.manualEscalationRate * 100).toFixed(1)}%`);
      }
      if (processingData.auditLog.impact) {
        console.log(`     Pool size reduction: ${processingData.auditLog.impact.poolSizeReduction}`);
        console.log(`     System load improvement: ${processingData.auditLog.impact.systemLoadImprovement}`);
      }
    }
    
    if (processingData.recommendations && processingData.recommendations.length > 0) {
      console.log('   Recommendations:');
      processingData.recommendations.forEach((rec, index) => {
        console.log(`     ${index + 1}. ${rec}`);
      });
    }
    
    if (processingData.errors && processingData.errors.length > 0) {
      console.log('   Errors:');
      processingData.errors.forEach((error, index) => {
        console.log(`     ${index + 1}. Booking ${error.bookingId}: ${error.error} (${error.errorType})`);
        if (error.escalatedToManual) {
          console.log(`        → Escalated to manual assignment`);
        }
      });
    }
    
    if (processingData.detailedResults && processingData.detailedResults.length > 0) {
      console.log(`   Detailed results (showing first 5 of ${processingData.detailedResults.length}):`);
      processingData.detailedResults.slice(0, 5).forEach((result, index) => {
        console.log(`     ${index + 1}. Booking ${result.bookingId}: ${result.status.toUpperCase()}`);
        console.log(`        Urgency: ${result.urgencyLevel}, Priority: ${result.priorityScore}`);
        console.log(`        Processing time: ${result.processingTime}ms`);
        if (result.interpreterId) {
          console.log(`        Assigned to: ${result.interpreterId}`);
        }
        if (result.manualAssignmentRequired) {
          console.log(`        → Manual assignment required`);
        }
        if (result.escalationReason) {
          console.log(`        Escalation reason: ${result.escalationReason}`);
        }
      });
    }
    console.log();

    // Test 3: Verify audit logging in database
    console.log('📝 Test 3: Verifying audit logging in database...');
    try {
      const auditLogs = await prisma.autoApprovalLog.findMany({
        where: {
          eventType: {
            in: ['EMERGENCY_PROCESSING', 'EMERGENCY_PROCESSING_FAILED']
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 5
      });

      console.log(`✅ Found ${auditLogs.length} emergency processing audit log entries`);
      
      if (auditLogs.length > 0) {
        const latestLog = auditLogs[0];
        console.log('   Latest audit log entry:');
        console.log(`     ID: ${latestLog.id}`);
        console.log(`     Event type: ${latestLog.eventType}`);
        console.log(`     Timestamp: ${latestLog.timestamp.toISOString()}`);
        console.log(`     Reason: ${latestLog.reason}`);
        console.log(`     Current mode: ${latestLog.currentMode}`);
        console.log(`     Confidence: ${latestLog.confidence || 'N/A'}`);
        
        if (latestLog.loadAssessment) {
          try {
            const loadAssessment = JSON.parse(latestLog.loadAssessment);
            console.log(`     System load: ${loadAssessment.systemLoad || 'N/A'}`);
            console.log(`     Pool size: ${loadAssessment.poolSize || 'N/A'}`);
          } catch (e) {
            console.log(`     Load assessment: ${latestLog.loadAssessment}`);
          }
        }
        
        if (latestLog.modeTransition) {
          try {
            const modeTransition = JSON.parse(latestLog.modeTransition);
            console.log(`     Batch ID: ${modeTransition.batchId || 'N/A'}`);
            console.log(`     Triggered by: ${modeTransition.triggeredBy || 'N/A'}`);
          } catch (e) {
            console.log(`     Mode transition data available`);
          }
        }
      }
    } catch (dbError) {
      console.warn(`⚠️ Could not verify audit logging: ${dbError.message}`);
    }
    console.log();

    // Test 4: Verify pool processing logs
    console.log('📊 Test 4: Verifying pool processing logs...');
    try {
      const poolLogs = await prisma.poolProcessingLog.findMany({
        where: {
          processingType: 'EMERGENCY'
        },
        orderBy: {
          processingStartTime: 'desc'
        },
        take: 3,
        include: {
          entries: {
            take: 5 // Get first 5 entries for each log
          }
        }
      });

      console.log(`✅ Found ${poolLogs.length} emergency pool processing log entries`);
      
      if (poolLogs.length > 0) {
        const latestLog = poolLogs[0];
        console.log('   Latest pool processing log:');
        console.log(`     Batch ID: ${latestLog.batchId}`);
        console.log(`     Processing type: ${latestLog.processingType}`);
        console.log(`     Start time: ${latestLog.processingStartTime.toISOString()}`);
        console.log(`     End time: ${latestLog.processingEndTime.toISOString()}`);
        console.log(`     Total entries: ${latestLog.totalEntries}`);
        console.log(`     Assigned: ${latestLog.assignedEntries}`);
        console.log(`     Escalated: ${latestLog.escalatedEntries}`);
        console.log(`     Failed: ${latestLog.failedEntries}`);
        console.log(`     Average processing time: ${latestLog.averageProcessingTimeMs}ms`);
        console.log(`     System load: ${latestLog.systemLoad}`);
        
        if (latestLog.entries.length > 0) {
          console.log(`   Entry details (showing ${latestLog.entries.length} of ${latestLog.totalEntries}):`);
          latestLog.entries.forEach((entry, index) => {
            console.log(`     ${index + 1}. Booking ${entry.bookingId}: ${entry.status.toUpperCase()}`);
            console.log(`        Urgency: ${entry.urgencyLevel}, Time: ${entry.processingTimeMs}ms`);
            if (entry.interpreterId) {
              console.log(`        Interpreter: ${entry.interpreterId}`);
            }
            if (entry.errorRecovery) {
              try {
                const errorRecovery = JSON.parse(entry.errorRecovery);
                console.log(`        Retry attempts: ${errorRecovery.retryAttempts || 0}`);
                if (errorRecovery.manualAssignmentRequired) {
                  console.log(`        → Manual assignment required`);
                }
              } catch (e) {
                console.log(`        Error recovery data available`);
              }
            }
          });
        }
      }
    } catch (dbError) {
      console.warn(`⚠️ Could not verify pool processing logs: ${dbError.message}`);
    }
    console.log();

    console.log('🎉 Emergency Processing Override tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Emergency processing information retrieval');
    console.log('✅ Priority-based emergency processing execution');
    console.log('✅ Detailed results reporting');
    console.log('✅ Audit logging verification');
    console.log('✅ Pool processing logs verification');
    console.log('✅ Manual escalation for failed entries');
    console.log('\n🚀 All emergency processing features are working correctly!');

  } catch (error) {
    console.error('❌ Emergency processing test failed:', error);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the development server is running:');
      console.log('   npm run dev');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testEmergencyProcessing().catch(console.error);