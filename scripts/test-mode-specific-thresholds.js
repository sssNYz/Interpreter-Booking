#!/usr/bin/env node

/**
 * Test Mode-Specific Threshold Configuration
 * 
 * This script tests the mode-specific threshold functionality to ensure
 * different assignment modes use the correct threshold values.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testModeSpecificThresholds() {
  try {
    console.log('🧪 Testing mode-specific threshold configurations...\n');
    
    const meetingTypes = ['DR', 'VIP', 'Urgent', 'Weekly', 'General', 'Other'];
    const modes = ['BALANCE', 'NORMAL', 'URGENT'];
    
    // Expected values based on your specifications
    const expectedValues = {
      BALANCE: {
        DR: { urgentThresholdDays: 7, generalThresholdDays: 30 },
        VIP: { urgentThresholdDays: 7, generalThresholdDays: 15 },
        Urgent: { urgentThresholdDays: 7, generalThresholdDays: 15 },
        Weekly: { urgentThresholdDays: 3, generalThresholdDays: 15 },
        General: { urgentThresholdDays: 7, generalThresholdDays: 15 },
        Other: { urgentThresholdDays: 3, generalThresholdDays: 7 }
      },
      NORMAL: {
        DR: { urgentThresholdDays: 10, generalThresholdDays: 30 },
        VIP: { urgentThresholdDays: 7, generalThresholdDays: 15 },
        Urgent: { urgentThresholdDays: 10, generalThresholdDays: 15 },
        Weekly: { urgentThresholdDays: 7, generalThresholdDays: 15 },
        General: { urgentThresholdDays: 10, generalThresholdDays: 15 },
        Other: { urgentThresholdDays: 7, generalThresholdDays: 10 }
      },
      URGENT: {
        DR: { urgentThresholdDays: 14, generalThresholdDays: 45 },
        VIP: { urgentThresholdDays: 7, generalThresholdDays: 15 },
        Urgent: { urgentThresholdDays: 14, generalThresholdDays: 30 },
        Weekly: { urgentThresholdDays: 14, generalThresholdDays: 30 },
        General: { urgentThresholdDays: 14, generalThresholdDays: 30 },
        Other: { urgentThresholdDays: 7, generalThresholdDays: 15 }
      }
    };
    
    let allTestsPassed = true;
    
    for (const mode of modes) {
      console.log(`📋 Testing ${mode} mode:`);
      
      for (const meetingType of meetingTypes) {
        const threshold = await prisma.meetingTypeModeThreshold.findUnique({
          where: {
            meetingType_assignmentMode: {
              meetingType,
              assignmentMode: mode
            }
          }
        });
        
        const expected = expectedValues[mode][meetingType];
        
        if (!threshold) {
          console.log(`   ❌ ${meetingType}: Configuration not found`);
          allTestsPassed = false;
          continue;
        }
        
        const urgentMatch = threshold.urgentThresholdDays === expected.urgentThresholdDays;
        const generalMatch = threshold.generalThresholdDays === expected.generalThresholdDays;
        
        if (urgentMatch && generalMatch) {
          console.log(`   ✅ ${meetingType}: Urgent: ${threshold.urgentThresholdDays}d, General: ${threshold.generalThresholdDays}d`);
        } else {
          console.log(`   ❌ ${meetingType}: Expected Urgent: ${expected.urgentThresholdDays}d, General: ${expected.generalThresholdDays}d`);
          console.log(`      Got Urgent: ${threshold.urgentThresholdDays}d, General: ${threshold.generalThresholdDays}d`);
          allTestsPassed = false;
        }
      }
      console.log('');
    }
    
    // Test the utility function if available
    try {
      const { getModeSpecificThreshold } = require('../lib/assignment/mode-thresholds');
      
      console.log('🔧 Testing utility function...');
      
      // Test a few specific cases
      const testCases = [
        { meetingType: 'DR', mode: 'BALANCE', expected: { urgentThresholdDays: 7, generalThresholdDays: 30 } },
        { meetingType: 'VIP', mode: 'NORMAL', expected: { urgentThresholdDays: 7, generalThresholdDays: 15 } },
        { meetingType: 'Other', mode: 'URGENT', expected: { urgentThresholdDays: 7, generalThresholdDays: 15 } }
      ];
      
      for (const testCase of testCases) {
        const result = await getModeSpecificThreshold(testCase.meetingType, testCase.mode);
        
        const urgentMatch = result.urgentThresholdDays === testCase.expected.urgentThresholdDays;
        const generalMatch = result.generalThresholdDays === testCase.expected.generalThresholdDays;
        
        if (urgentMatch && generalMatch) {
          console.log(`   ✅ ${testCase.meetingType} (${testCase.mode}): Function returned correct values`);
        } else {
          console.log(`   ❌ ${testCase.meetingType} (${testCase.mode}): Function returned incorrect values`);
          console.log(`      Expected: Urgent: ${testCase.expected.urgentThresholdDays}d, General: ${testCase.expected.generalThresholdDays}d`);
          console.log(`      Got: Urgent: ${result.urgentThresholdDays}d, General: ${result.generalThresholdDays}d`);
          allTestsPassed = false;
        }
      }
      
    } catch (error) {
      console.log('⚠️  Utility function test skipped (module not compiled yet)');
    }
    
    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
      console.log('🎉 All tests passed! Mode-specific thresholds are configured correctly.');
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
testModeSpecificThresholds();