/**
 * Test script for Daily Pool Processor
 * Tests the daily pool processing scheduler functionality
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDailyPoolProcessor() {
  console.log('🧪 Testing Daily Pool Processor...\n');

  try {
    // Import the daily pool processor
    const { 
      DailyPoolProcessor, 
      initializeDailyPoolProcessor,
      getDailyPoolProcessor,
      processDailyPoolNow,
      getDailyProcessingStatistics
    } = await import('../lib/assignment/daily-pool-processor.ts');

    // Test 1: Initialize daily pool processor
    console.log('📋 Test 1: Initialize Daily Pool Processor');
    await initializeDailyPoolProcessor();
    
    const processor = getDailyPoolProcessor();
    if (processor) {
      console.log('✅ Daily pool processor initialized successfully');
      console.log('Status:', processor.getStatus());
    } else {
      console.log('❌ Failed to initialize daily pool processor');
      return;
    }

    // Test 2: Get processing statistics
    console.log('\n📊 Test 2: Get Processing Statistics');
    const statistics = await getDailyProcessingStatistics();
    console.log('Statistics:', JSON.stringify(statistics, null, 2));

    // Test 3: Check if processing is needed
    console.log('\n🔍 Test 3: Check Processing Need');
    const processingNeeded = await processor.isProcessingNeeded();
    console.log('Processing needed:', processingNeeded);

    // Test 4: Get pool status before processing
    console.log('\n📈 Test 4: Pool Status Before Processing');
    const { bookingPool } = await import('../lib/assignment/pool.ts');
    const poolStatsBefore = await bookingPool.getPoolStats();
    console.log('Pool stats before:', JSON.stringify(poolStatsBefore, null, 2));

    // Test 5: Run daily processing
    console.log('\n⚡ Test 5: Run Daily Pool Processing');
    const processingResult = await processDailyPoolNow();
    console.log('Processing result:', JSON.stringify(processingResult, null, 2));

    // Test 6: Get pool status after processing
    console.log('\n📉 Test 6: Pool Status After Processing');
    const poolStatsAfter = await bookingPool.getPoolStats();
    console.log('Pool stats after:', JSON.stringify(poolStatsAfter, null, 2));

    // Test 7: Test processor status
    console.log('\n📋 Test 7: Processor Status');
    const finalStatus = processor.getStatus();
    console.log('Final processor status:', JSON.stringify(finalStatus, null, 2));

    // Test 8: Test server startup integration
    console.log('\n🚀 Test 8: Server Startup Integration');
    const { getServerStatus } = await import('../lib/assignment/server-startup.ts');
    const serverStatus = await getServerStatus();
    console.log('Server status:', JSON.stringify(serverStatus, null, 2));

    console.log('\n✅ All Daily Pool Processor tests completed successfully!');

  } catch (error) {
    console.error('❌ Daily Pool Processor test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDailyPoolProcessor().catch(console.error);