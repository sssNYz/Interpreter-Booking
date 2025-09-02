/**
 * Test script for Daily Pool Processor API
 * Tests the API endpoints for daily pool processing
 */

async function testDailyProcessorAPI() {
  console.log('🧪 Testing Daily Pool Processor API...\n');

  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test 1: Get processor status
    console.log('📋 Test 1: Get Processor Status');
    try {
      const response = await fetch(`${baseUrl}/api/admin/pool/daily-processor`);
      const data = await response.json();
      console.log('Status response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('❌ Status check failed (server may not be running):', error.message);
    }

    // Test 2: Initialize processor
    console.log('\n🚀 Test 2: Initialize Processor');
    try {
      const response = await fetch(`${baseUrl}/api/admin/pool/daily-processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'initialize' }),
      });
      const data = await response.json();
      console.log('Initialize response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('❌ Initialize failed (server may not be running):', error.message);
    }

    // Test 3: Start processor
    console.log('\n▶️ Test 3: Start Processor');
    try {
      const response = await fetch(`${baseUrl}/api/admin/pool/daily-processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await response.json();
      console.log('Start response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('❌ Start failed (server may not be running):', error.message);
    }

    // Test 4: Process now
    console.log('\n⚡ Test 4: Process Now');
    try {
      const response = await fetch(`${baseUrl}/api/admin/pool/daily-processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'process_now' }),
      });
      const data = await response.json();
      console.log('Process now response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('❌ Process now failed (server may not be running):', error.message);
    }

    // Test 5: Get final status
    console.log('\n📊 Test 5: Get Final Status');
    try {
      const response = await fetch(`${baseUrl}/api/admin/pool/daily-processor`);
      const data = await response.json();
      console.log('Final status response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('❌ Final status check failed (server may not be running):', error.message);
    }

    console.log('\n✅ Daily Pool Processor API tests completed!');
    console.log('Note: Some tests may fail if the server is not running on localhost:3000');

  } catch (error) {
    console.error('❌ Daily Pool Processor API test failed:', error);
  }
}

// Check if we're running this script directly
if (require.main === module) {
  testDailyProcessorAPI().catch(console.error);
}

module.exports = { testDailyProcessorAPI };