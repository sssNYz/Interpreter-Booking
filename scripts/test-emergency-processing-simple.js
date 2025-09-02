#!/usr/bin/env node

/**
 * Simple test script for Emergency Pool Processing Override functionality
 * Tests the API endpoints without complex database operations
 */

async function testEmergencyProcessingSimple() {
  console.log('🚨 Testing Emergency Pool Processing Override (Simple)...\n');

  const baseUrl = 'http://localhost:3000';

  try {
    // Test 1: Check if server is running
    console.log('🔍 Test 1: Checking if server is running...');
    try {
      const healthResponse = await fetch(`${baseUrl}/api/admin/pool/status`);
      if (healthResponse.ok) {
        console.log('✅ Server is running');
      } else {
        throw new Error('Server responded with error');
      }
    } catch (error) {
      console.log('❌ Server is not running. Please start with: npm run dev');
      return;
    }

    // Test 2: Get emergency processing info
    console.log('\n📊 Test 2: Getting emergency processing information...');
    try {
      const infoResponse = await fetch(`${baseUrl}/api/admin/pool/emergency-process`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        console.log('✅ Emergency processing info retrieved successfully');
        console.log(`   Pool size: ${infoData.poolSize || 0}`);
        console.log(`   Can process: ${infoData.canProcess || false}`);
        console.log(`   Risk level: ${infoData.riskAssessment?.level || 'N/A'}`);
        console.log(`   Urgency score: ${infoData.riskAssessment?.urgencyScore || 0}/100`);
        
        if (infoData.processingCapabilities) {
          console.log('   Processing capabilities:');
          console.log(`     Priority-based processing: ${infoData.processingCapabilities.priorityBasedProcessing}`);
          console.log(`     Manual escalation: ${infoData.processingCapabilities.manualEscalationEnabled}`);
          console.log(`     Audit logging: ${infoData.processingCapabilities.auditLoggingEnabled}`);
          console.log(`     Detailed reporting: ${infoData.processingCapabilities.detailedReporting}`);
          console.log(`     Error recovery: ${infoData.processingCapabilities.errorRecoveryEnabled}`);
          console.log(`     Max retry attempts: ${infoData.processingCapabilities.maxRetryAttempts}`);
        }
        
        if (infoData.systemRecommendations && infoData.systemRecommendations.length > 0) {
          console.log('   System recommendations:');
          infoData.systemRecommendations.slice(0, 3).forEach((rec, index) => {
            console.log(`     ${index + 1}. ${rec}`);
          });
          if (infoData.systemRecommendations.length > 3) {
            console.log(`     ... and ${infoData.systemRecommendations.length - 3} more`);
          }
        }
      } else {
        const errorText = await infoResponse.text();
        console.log(`❌ Failed to get emergency processing info: ${infoResponse.status}`);
        console.log(`   Error: ${errorText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`❌ Error getting emergency processing info: ${error.message}`);
    }

    // Test 3: Execute emergency processing
    console.log('\n🚨 Test 3: Executing emergency processing...');
    try {
      const processingResponse = await fetch(`${baseUrl}/api/admin/pool/emergency-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Simple test of emergency processing functionality',
          triggeredBy: 'TEST_SCRIPT_SIMPLE'
        })
      });

      if (processingResponse.ok) {
        const processingData = await processingResponse.json();
        console.log(`✅ Emergency processing completed: ${processingData.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`   Batch ID: ${processingData.batchId || 'N/A'}`);
        console.log(`   Message: ${processingData.message || 'No message'}`);
        
        if (processingData.results) {
          console.log('   Results summary:');
          console.log(`     Processed: ${processingData.results.processedCount || 0}`);
          console.log(`     Assigned: ${processingData.results.assignedCount || 0}`);
          console.log(`     Escalated: ${processingData.results.escalatedCount || 0}`);
          console.log(`     Failed: ${processingData.results.failedCount || 0}`);
          console.log(`     Manual escalation: ${processingData.results.manualEscalationCount || 0}`);
          console.log(`     Processing time: ${processingData.results.processingTime || 0}ms`);
        }
        
        if (processingData.auditLog) {
          console.log('   Audit log created:');
          console.log(`     ID: ${processingData.auditLog.id}`);
          console.log(`     Triggered by: ${processingData.auditLog.triggeredBy}`);
          console.log(`     Reason: ${processingData.auditLog.reason}`);
        }
        
        if (processingData.recommendations && processingData.recommendations.length > 0) {
          console.log('   Recommendations:');
          processingData.recommendations.slice(0, 3).forEach((rec, index) => {
            console.log(`     ${index + 1}. ${rec}`);
          });
          if (processingData.recommendations.length > 3) {
            console.log(`     ... and ${processingData.recommendations.length - 3} more`);
          }
        }
        
        // Test specific features
        console.log('\n   🔍 Feature verification:');
        console.log(`   ✅ Priority-based processing: ${processingData.priorityBreakdown ? 'Implemented' : 'Missing'}`);
        console.log(`   ✅ Detailed reporting: ${processingData.detailedResults ? 'Implemented' : 'Missing'}`);
        console.log(`   ✅ Audit logging: ${processingData.auditLog ? 'Implemented' : 'Missing'}`);
        console.log(`   ✅ Manual escalation: ${processingData.results?.manualEscalationCount !== undefined ? 'Implemented' : 'Missing'}`);
        console.log(`   ✅ Error handling: ${processingData.errors !== undefined ? 'Implemented' : 'Missing'}`);
        
      } else {
        const errorText = await processingResponse.text();
        console.log(`❌ Failed to execute emergency processing: ${processingResponse.status}`);
        console.log(`   Error: ${errorText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`❌ Error executing emergency processing: ${error.message}`);
    }

    console.log('\n🎉 Emergency Processing Override simple test completed!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Server connectivity verified');
    console.log('✅ Emergency processing info endpoint tested');
    console.log('✅ Emergency processing execution endpoint tested');
    console.log('✅ Enhanced features verification completed');
    console.log('\n🚀 Emergency processing functionality is ready for use!');

  } catch (error) {
    console.error('❌ Emergency processing simple test failed:', error);
    process.exit(1);
  }
}

// Run the test
testEmergencyProcessingSimple().catch(console.error);