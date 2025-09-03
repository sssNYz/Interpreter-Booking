#!/usr/bin/env node

/**
 * Simple test to verify mode-specific thresholds are working
 * This bypasses TypeScript compilation issues by testing directly with JavaScript
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testModeThresholds() {
  try {
    console.log('🧪 Testing mode-specific threshold retrieval...\n');
    
    // Test cases to verify the system is using mode-specific thresholds
    const testCases = [
      { meetingType: 'DR', mode: 'BALANCE', expected: { urgent: 7, general: 30 } },
      { meetingType: 'DR', mode: 'NORMAL', expected: { urgent: 10, general: 30 } },
      { meetingType: 'DR', mode: 'URGENT', expected: { urgent: 14, general: 45 } },
      { meetingType: 'VIP', mode: 'BALANCE', expected: { urgent: 7, general: 15 } },
      { meetingType: 'Other', mode: 'NORMAL', expected: { urgent: 7, general: 10 } }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      const result = await prisma.meetingTypeModeThreshold.findUnique({
        where: {
          meetingType_assignmentMode: {
            meetingType: testCase.meetingType,
            assignmentMode: testCase.mode
          }
        }
      });
      
      if (!result) {
        console.log(`❌ ${testCase.meetingType} (${testCase.mode}): No configuration found`);
        allPassed = false;
        continue;
      }
      
      const urgentMatch = result.urgentThresholdDays === testCase.expected.urgent;
      const generalMatch = result.generalThresholdDays === testCase.expected.general;
      
      if (urgentMatch && generalMatch) {
        console.log(`✅ ${testCase.meetingType} (${testCase.mode}): Urgent: ${result.urgentThresholdDays}d, General: ${result.generalThresholdDays}d`);
      } else {
        console.log(`❌ ${testCase.meetingType} (${testCase.mode}): Expected Urgent: ${testCase.expected.urgent}d, General: ${testCase.expected.general}d`);
        console.log(`   Got Urgent: ${result.urgentThresholdDays}d, General: ${result.generalThresholdDays}d`);
        allPassed = false;
      }
    }
    
    // Test that the system can retrieve thresholds for all modes
    console.log('\n📊 Testing threshold retrieval for all modes...');
    
    const modes = ['BALANCE', 'NORMAL', 'URGENT'];
    for (const mode of modes) {
      const count = await prisma.meetingTypeModeThreshold.count({
        where: { assignmentMode: mode }
      });
      
      if (count === 6) { // Should have 6 meeting types per mode
        console.log(`✅ ${mode} mode: ${count} threshold configurations found`);
      } else {
        console.log(`❌ ${mode} mode: Expected 6 configurations, found ${count}`);
        allPassed = false;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('🎉 All mode-specific threshold tests passed!');
      console.log('💡 The system should now use different thresholds based on assignment mode.');
      console.log('🔄 Restart your development server to pick up the changes.');
    } else {
      console.log('❌ Some tests failed. Please check the configuration.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error testing mode-specific thresholds:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testModeThresholds();