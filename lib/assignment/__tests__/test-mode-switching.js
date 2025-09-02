/**
 * Test script for mode switching functionality
 * Run with: node lib/assignment/__tests__/test-mode-switching.js
 */

const { PrismaClient } = require('@prisma/client');

async function testModeSwitch() {
  console.log('🧪 Testing Mode Switching Functionality...\n');

  try {
    // Import the mode transition manager
    const { modeTransitionManager } = await import('../mode-transition.ts');
    const { loadPolicy } = await import('../policy.ts');

    // Get current mode
    const currentPolicy = await loadPolicy();
    console.log(`📊 Current mode: ${currentPolicy.mode}`);

    // Test switching to a different mode
    const targetMode = currentPolicy.mode === 'NORMAL' ? 'URGENT' : 'NORMAL';
    console.log(`🔄 Testing switch to: ${targetMode}`);

    // Perform the mode switch
    const result = await modeTransitionManager.switchMode(targetMode);

    if (result.success) {
      console.log('✅ Mode switch successful!');
      console.log(`   Old mode: ${result.oldMode}`);
      console.log(`   New mode: ${result.newMode}`);
      console.log(`   Pooled bookings affected: ${result.pooledBookingsAffected}`);
      console.log(`   Immediate assignments: ${result.immediateAssignments}`);
      console.log(`   Transition time: ${result.transitionTime.toISOString()}`);
      
      if (result.userFeedback.summary) {
        console.log(`   Summary: ${result.userFeedback.summary}`);
      }

      if (result.userFeedback.warnings.length > 0) {
        console.log(`   Warnings: ${result.userFeedback.warnings.join(', ')}`);
      }

      if (result.userFeedback.recommendations.length > 0) {
        console.log(`   Recommendations: ${result.userFeedback.recommendations.join(', ')}`);
      }

      // Switch back to original mode
      console.log(`\n🔄 Switching back to original mode: ${currentPolicy.mode}`);
      const revertResult = await modeTransitionManager.switchMode(currentPolicy.mode);
      
      if (revertResult.success) {
        console.log('✅ Successfully reverted to original mode');
      } else {
        console.log('❌ Failed to revert to original mode');
        console.log(`   Errors: ${revertResult.errors.map(e => e.error).join(', ')}`);
      }

    } else {
      console.log('❌ Mode switch failed!');
      console.log(`   Errors: ${result.errors.map(e => e.error).join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Test pool re-evaluation logic
async function testPoolReEvaluation() {
  console.log('\n🧪 Testing Pool Re-evaluation Logic...\n');

  try {
    const { bookingPool } = await import('../pool.ts');
    const { loadPolicy } = await import('../policy.ts');

    // Get current pool status
    const poolStats = await bookingPool.getPoolStats();
    console.log(`📊 Current pool stats:`);
    console.log(`   Total in pool: ${poolStats.totalInPool}`);
    console.log(`   Ready for processing: ${poolStats.readyForProcessing}`);
    console.log(`   Currently processing: ${poolStats.currentlyProcessing}`);
    console.log(`   Failed entries: ${poolStats.failedEntries}`);

    if (poolStats.totalInPool === 0) {
      console.log('ℹ️ No bookings in pool to test re-evaluation');
      return;
    }

    // Test mode-specific pool processing
    const currentPolicy = await loadPolicy();
    console.log(`\n🔄 Testing pool processing for ${currentPolicy.mode} mode...`);

    const { processPoolEntries } = await import('../pool.ts');
    const readyEntries = await processPoolEntries(currentPolicy.mode);

    console.log(`📋 Found ${readyEntries.length} entries ready for processing`);
    
    if (readyEntries.length > 0) {
      console.log('   Entry details:');
      readyEntries.slice(0, 3).forEach((entry, index) => {
        console.log(`   ${index + 1}. Booking ${entry.bookingId} (${entry.meetingType}, mode: ${entry.mode}, priority: ${entry.processingPriority})`);
      });
      
      if (readyEntries.length > 3) {
        console.log(`   ... and ${readyEntries.length - 3} more entries`);
      }
    }

  } catch (error) {
    console.error('❌ Pool re-evaluation test failed:', error);
  }
}

// Test graceful handling of active processing
async function testActiveProcessingHandling() {
  console.log('\n🧪 Testing Active Processing Handling...\n');

  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Check for any bookings currently being processed
    const processingBookings = await prisma.bookingPlan.findMany({
      where: {
        poolStatus: 'processing'
      },
      select: {
        bookingId: true,
        poolEntryTime: true,
        poolProcessingAttempts: true
      }
    });

    console.log(`📊 Found ${processingBookings.length} bookings currently being processed`);

    if (processingBookings.length > 0) {
      console.log('   Processing bookings:');
      processingBookings.forEach(booking => {
        console.log(`   - Booking ${booking.bookingId} (attempts: ${booking.poolProcessingAttempts})`);
      });

      // Test the active processing check
      const { modeTransitionManager } = await import('../mode-transition.ts');
      const checkResult = await modeTransitionManager.checkActivePoolProcessing();
      
      console.log(`✅ Active processing check completed:`);
      console.log(`   Has active processing: ${checkResult.hasActiveProcessing}`);
      console.log(`   Processing bookings: ${checkResult.processingBookings.length}`);
    } else {
      console.log('ℹ️ No active processing detected - system is ready for mode switching');
    }

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Active processing test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Mode Switching Tests\n');
  console.log('=' .repeat(50));

  await testModeSwitch();
  await testPoolReEvaluation();
  await testActiveProcessingHandling();

  console.log('\n' + '='.repeat(50));
  console.log('✅ Mode switching tests completed');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testModeSwitch,
  testPoolReEvaluation,
  testActiveProcessingHandling,
  runAllTests
};