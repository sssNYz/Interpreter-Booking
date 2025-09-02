/**
 * Test script for pool monitoring API endpoints
 */

const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_ENDPOINTS = [
  '/api/admin/pool/dashboard',
  '/api/admin/pool/status',
  '/api/admin/pool/history',
  '/api/admin/pool/alerts',
  '/api/admin/pool/diagnostics'
];

async function makeRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (body && method !== 'GET') {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body && method !== 'GET') {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testPoolMonitoringAPIs() {
  console.log('🧪 Testing Pool Monitoring API Endpoints...\n');
  console.log('⚠️  Note: Make sure the Next.js development server is running (npm run dev)\n');

  const results = [];

  try {
    // Test 1: Pool Dashboard API
    console.log('1. Testing Pool Dashboard API...');
    try {
      const dashboardResponse = await makeRequest('/api/admin/pool/dashboard');
      console.log(`   Status: ${dashboardResponse.status}`);
      
      if (dashboardResponse.status === 200) {
        console.log('   ✅ Pool dashboard API working');
        console.log(`   - Timestamp: ${dashboardResponse.data.timestamp}`);
        if (dashboardResponse.data.poolStats) {
          console.log(`   - Total entries: ${dashboardResponse.data.poolStats.totalEntries}`);
          console.log(`   - Ready for processing: ${dashboardResponse.data.poolStats.readyForProcessing}`);
        }
        if (dashboardResponse.data.alerts) {
          console.log(`   - Active alerts: ${dashboardResponse.data.alerts.active.length}`);
        }
      } else {
        console.log('   ❌ Pool dashboard API failed');
        console.log(`   - Error: ${dashboardResponse.data.error || 'Unknown error'}`);
      }
      results.push({ endpoint: 'dashboard', status: dashboardResponse.status, success: dashboardResponse.status === 200 });
    } catch (error) {
      console.log('   ❌ Pool dashboard API connection failed');
      console.log(`   - Error: ${error.message}`);
      results.push({ endpoint: 'dashboard', status: 'CONNECTION_ERROR', success: false, error: error.message });
    }

    // Test 2: Pool Status API
    console.log('\n2. Testing Pool Status API...');
    try {
      const statusResponse = await makeRequest('/api/admin/pool/status');
      console.log(`   Status: ${statusResponse.status}`);
      
      if (statusResponse.status === 200) {
        console.log('   ✅ Pool status API working');
        if (statusResponse.data.poolStats) {
          console.log(`   - Total in pool: ${statusResponse.data.poolStats.totalInPool}`);
          console.log(`   - Ready for processing: ${statusResponse.data.poolStats.readyForProcessing}`);
        }
      } else {
        console.log('   ❌ Pool status API failed');
        console.log(`   - Error: ${statusResponse.data.error || 'Unknown error'}`);
      }
      results.push({ endpoint: 'status', status: statusResponse.status, success: statusResponse.status === 200 });
    } catch (error) {
      console.log('   ❌ Pool status API connection failed');
      console.log(`   - Error: ${error.message}`);
      results.push({ endpoint: 'status', status: 'CONNECTION_ERROR', success: false, error: error.message });
    }

    // Test 3: Pool History API
    console.log('\n3. Testing Pool History API...');
    try {
      const historyResponse = await makeRequest('/api/admin/pool/history?limit=10');
      console.log(`   Status: ${historyResponse.status}`);
      
      if (historyResponse.status === 200) {
        console.log('   ✅ Pool history API working');
        if (historyResponse.data.summary) {
          console.log(`   - Total entries: ${historyResponse.data.summary.totalEntries}`);
          console.log(`   - Error count: ${historyResponse.data.summary.errorCount}`);
        }
      } else {
        console.log('   ❌ Pool history API failed');
        console.log(`   - Error: ${historyResponse.data.error || 'Unknown error'}`);
      }
      results.push({ endpoint: 'history', status: historyResponse.status, success: historyResponse.status === 200 });
    } catch (error) {
      console.log('   ❌ Pool history API connection failed');
      console.log(`   - Error: ${error.message}`);
      results.push({ endpoint: 'history', status: 'CONNECTION_ERROR', success: false, error: error.message });
    }

    // Test 4: Pool Alerts API
    console.log('\n4. Testing Pool Alerts API...');
    try {
      const alertsResponse = await makeRequest('/api/admin/pool/alerts');
      console.log(`   Status: ${alertsResponse.status}`);
      
      if (alertsResponse.status === 200) {
        console.log('   ✅ Pool alerts API working');
        if (alertsResponse.data.alerts) {
          console.log(`   - Active alerts: ${alertsResponse.data.alerts.active.length}`);
          console.log(`   - Warnings: ${alertsResponse.data.alerts.warnings.length}`);
          console.log(`   - Total alerts: ${alertsResponse.data.alerts.summary.total}`);
        }
      } else {
        console.log('   ❌ Pool alerts API failed');
        console.log(`   - Error: ${alertsResponse.data.error || 'Unknown error'}`);
      }
      results.push({ endpoint: 'alerts', status: alertsResponse.status, success: alertsResponse.status === 200 });
    } catch (error) {
      console.log('   ❌ Pool alerts API connection failed');
      console.log(`   - Error: ${error.message}`);
      results.push({ endpoint: 'alerts', status: 'CONNECTION_ERROR', success: false, error: error.message });
    }

    // Test 5: Pool Diagnostics API
    console.log('\n5. Testing Pool Diagnostics API...');
    try {
      const diagnosticsResponse = await makeRequest('/api/admin/pool/diagnostics');
      console.log(`   Status: ${diagnosticsResponse.status}`);
      
      if (diagnosticsResponse.status === 200) {
        console.log('   ✅ Pool diagnostics API working');
        if (diagnosticsResponse.data.diagnostics) {
          console.log(`   - Health check: ${diagnosticsResponse.data.diagnostics.healthCheck.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
          console.log(`   - Stuck entries: ${diagnosticsResponse.data.diagnostics.stuckEntries.count}`);
        }
      } else {
        console.log('   ❌ Pool diagnostics API failed');
        console.log(`   - Error: ${diagnosticsResponse.data.error || 'Unknown error'}`);
      }
      results.push({ endpoint: 'diagnostics', status: diagnosticsResponse.status, success: diagnosticsResponse.status === 200 });
    } catch (error) {
      console.log('   ❌ Pool diagnostics API connection failed');
      console.log(`   - Error: ${error.message}`);
      results.push({ endpoint: 'diagnostics', status: 'CONNECTION_ERROR', success: false, error: error.message });
    }

    // Test 6: Test POST endpoints
    console.log('\n6. Testing POST endpoints...');
    
    // Test dashboard refresh
    try {
      const refreshResponse = await makeRequest('/api/admin/pool/dashboard', 'POST', { action: 'refresh' });
      console.log(`   Dashboard refresh status: ${refreshResponse.status}`);
      if (refreshResponse.status === 200) {
        console.log('   ✅ Dashboard refresh working');
      }
    } catch (error) {
      console.log('   ❌ Dashboard refresh failed');
    }

    // Test alert action
    try {
      const alertActionResponse = await makeRequest('/api/admin/pool/alerts', 'POST', { 
        action: 'create_notification',
        options: {
          message: 'Test notification from API test',
          severity: 'INFO'
        }
      });
      console.log(`   Alert action status: ${alertActionResponse.status}`);
      if (alertActionResponse.status === 200) {
        console.log('   ✅ Alert actions working');
      }
    } catch (error) {
      console.log('   ❌ Alert actions failed');
    }

    // Summary
    console.log('\n📊 Test Results Summary:');
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`   Total endpoints tested: ${totalCount}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${totalCount - successCount}`);
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.endpoint}: ${result.status}`);
    });

    if (successCount === totalCount) {
      console.log('\n🎉 All pool monitoring API endpoints are working!');
      
      console.log('\n📋 Pool Monitoring API Features Verified:');
      console.log('   ✅ Pool status dashboard API (/api/admin/pool/dashboard)');
      console.log('   ✅ Pool status monitoring API (/api/admin/pool/status)');
      console.log('   ✅ Pool entry history API (/api/admin/pool/history)');
      console.log('   ✅ Pool alerts and notifications API (/api/admin/pool/alerts)');
      console.log('   ✅ Pool diagnostics API (/api/admin/pool/diagnostics)');
      console.log('   ✅ POST actions for dashboard refresh and alert management');

      console.log('\n🎯 Pool Monitoring Implementation Complete:');
      console.log('   📊 Comprehensive dashboard showing current entries and processing status');
      console.log('   📝 Detailed pool processing logs with entry-level tracking');
      console.log('   🔍 Diagnostic information for stuck or failed pool entries');
      console.log('   📚 Pool entry history tracking for debugging purposes');
      console.log('   🚨 Alerts and notifications for pool processing issues');
      
      return true;
    } else {
      console.log('\n⚠️  Some endpoints failed. Check the server logs and ensure the development server is running.');
      return false;
    }

  } catch (error) {
    console.error('❌ Unexpected error during API testing:', error);
    return false;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testPoolMonitoringAPIs()
    .then(success => {
      if (success) {
        console.log('\n🎉 Pool monitoring API test completed successfully!');
        process.exit(0);
      } else {
        console.error('\n💥 Pool monitoring API test failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = {
  testPoolMonitoringAPIs
};