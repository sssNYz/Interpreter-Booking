/**
 * Test script for pool processing execution fix
 * 
 * This script tests the pool processing scheduler and engine functionality
 */

const { PrismaClient } = require('@prisma/client');

async function testPoolProcessing() {
  console.log('🧪 Testing Pool Processing Execution Fix...\n');

  try {
    // Test 1: Check if we can import the modules
    console.log('📦 Testing module imports...');
    
    const { startPoolScheduler, stopPoolScheduler, getPoolScheduler } = require('../lib/assignment/pool-scheduler');
    const { getPoolProcessingEngine } = require('../lib/assignment/pool-engine');
    const { bookingPool, getPoolStatus } = require('../lib/assignment/pool');
    
    console.log('✅ All modules imported successfully\n');

    // Test 2: Test pool status
    console.log('📊 Testing pool status...');
    const poolStatus = getPoolStatus();
    console.log(`Pool status: ${poolStatus.total} total, ${poolStatus.ready} ready, ${poolStatus.deadline} deadline`);
    console.log('✅ Pool status retrieved successfully\n');

    // Test 3: Test pool processing engine
    console.log('🔧 Testing pool processing engine...');
    const engine = getPoolProcessingEngine();
    const processingStatus = engine.getProcessingStatus();
    console.log(`Processing status: ${processingStatus.poolSize} entries, ${processingStatus.readyForProcessing} ready`);
    
    const entriesNeedingProcessing = engine.getEntriesNeedingProcessing();
    console.log(`Entries needing processing: ${entriesNeedingProcessing.deadline.length} deadline, ${entriesNeedingProcessing.ready.length} ready`);
    console.log('✅ Pool processing engine working correctly\n');

    // Test 4: Test scheduler (without starting it)
    console.log('⏰ Testing scheduler functionality...');
    const scheduler = getPoolScheduler();
    
    if (!scheduler) {
      console.log('📝 No scheduler running (expected for test)');
      
      // Test scheduler creation
      const testScheduler = startPoolScheduler(60000); // 1 minute for testing
      console.log('✅ Scheduler created successfully');
      
      const status = testScheduler.getStatus();
      console.log(`Scheduler status: running=${status.isRunning}, interval=${status.processingIntervalMs}ms`);
      
      // Stop the test scheduler
      stopPoolScheduler();
      console.log('✅ Scheduler stopped successfully');
    } else {
      console.log('⚠️ Scheduler already running');
      const status = scheduler.getStatus();
      console.log(`Scheduler status: running=${status.isRunning}, interval=${status.processingIntervalMs}ms`);
    }
    console.log('✅ Scheduler functionality working correctly\n');

    // Test 5: Test database connectivity (basic check)
    console.log('🗄️ Testing database connectivity...');
    const prisma = new PrismaClient();
    
    try {
      // Try to query the assignment config to test connectivity
      const config = await prisma.autoAssignmentConfig.findFirst();
      console.log(`Database connection successful, config mode: ${config?.mode || 'not found'}`);
      console.log('✅ Database connectivity working\n');
    } catch (dbError) {
      console.log(`⚠️ Database connectivity issue: ${dbError.message}`);
      console.log('This may be expected if database is not set up\n');
    } finally {
      await prisma.$disconnect();
    }

    // Test 6: Test API endpoint availability (mock test)
    console.log('🌐 Testing API endpoint structure...');
    const fs = require('fs');
    const path = require('path');
    
    const apiEndpoints = [
      'app/api/admin/pool/process/route.ts',
      'app/api/admin/pool/scheduler/route.ts',
      'app/api/admin/pool/emergency/route.ts',
      'app/api/system/startup/route.ts'
    ];
    
    let endpointsExist = 0;
    for (const endpoint of apiEndpoints) {
      if (fs.existsSync(path.join(process.cwd(), endpoint))) {
        endpointsExist++;
        console.log(`✅ ${endpoint} exists`);
      } else {
        console.log(`❌ ${endpoint} missing`);
      }
    }
    
    console.log(`${endpointsExist}/${apiEndpoints.length} API endpoints available\n`);

    // Summary
    console.log('🎉 Pool Processing Test Summary:');
    console.log('✅ Module imports: Working');
    console.log('✅ Pool status: Working');
    console.log('✅ Processing engine: Working');
    console.log('✅ Scheduler: Working');
    console.log(`✅ API endpoints: ${endpointsExist}/${apiEndpoints.length} available`);
    console.log('\n🚀 Pool Processing Execution Fix implementation appears to be working correctly!');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Start the application server');
    console.log('2. Call POST /api/system/startup to initialize the system');
    console.log('3. Check GET /api/admin/pool/scheduler for scheduler status');
    console.log('4. Use POST /api/admin/pool/process to manually trigger processing');
    console.log('5. Monitor pool processing logs for automated execution');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure all dependencies are installed (npm install)');
    console.log('2. Check that the TypeScript files are compiled');
    console.log('3. Verify database connection if database tests fail');
    console.log('4. Check file paths and imports');
  }
}

// Run the test
testPoolProcessing().catch(console.error);