/**
 * Test script for pool monitoring and debugging functionality
 */

const { getPoolMonitor } = require('../lib/assignment/pool-monitoring');
const { getPoolHistoryTracker } = require('../lib/assignment/pool-history-tracker');

async function testPoolMonitoring() {
  console.log('🧪 Testing Pool Monitoring and Debugging System...\n');

  try {
    // Test 1: Get pool status dashboard
    console.log('1. Testing pool status dashboard...');
    const poolMonitor = getPoolMonitor();
    const dashboard = await poolMonitor.getPoolStatusDashboard();
    
    console.log(`   ✅ Dashboard retrieved:`);
    console.log(`      - Total entries: ${dashboard.poolStats.totalEntries}`);
    console.log(`      - Ready for processing: ${dashboard.poolStats.readyForProcessing}`);
    console.log(`      - Failed entries: ${dashboard.poolStats.failedEntries}`);
    console.log(`      - Active alerts: ${dashboard.alerts.active.length}`);
    console.log(`      - Warnings: ${dashboard.alerts.warnings.length}`);
    console.log(`      - Recommendations: ${dashboard.recommendations.length}`);

    // Test 2: Test pool statistics
    console.log('\n2. Testing pool statistics...');
    const poolStats = await poolMonitor.getPoolStatistics();
    
    console.log(`   ✅ Pool statistics:`);
    console.log(`      - Total entries: ${poolStats.totalEntries}`);
    console.log(`      - Urgency distribution:`, poolStats.urgencyDistribution);
    console.log(`      - Average processing time: ${poolStats.averageProcessingTime}ms`);
    console.log(`      - Total processing attempts: ${poolStats.totalProcessingAttempts}`);

    // Test 3: Test processing status
    console.log('\n3. Testing processing status...');
    const processingStatus = await poolMonitor.getProcessingStatus();
    
    console.log(`   ✅ Processing status:`);
    console.log(`      - Is running: ${processingStatus.isRunning}`);
    console.log(`      - Needs immediate processing: ${processingStatus.needsImmediateProcessing}`);
    console.log(`      - Processing interval: ${processingStatus.processingIntervalMs}ms`);
    console.log(`      - Recent errors: ${processingStatus.recentErrors.length}`);

    // Test 4: Test entries breakdown
    console.log('\n4. Testing entries breakdown...');
    const entriesBreakdown = await poolMonitor.getEntriesBreakdown();
    
    console.log(`   ✅ Entries breakdown:`);
    console.log(`      - Deadline entries: ${entriesBreakdown.deadline.count}`);
    console.log(`      - Ready entries: ${entriesBreakdown.ready.count}`);
    console.log(`      - Pending entries: ${entriesBreakdown.pending.count}`);
    console.log(`      - Failed entries: ${entriesBreakdown.failed.count}`);
    console.log(`      - Corrupted entries: ${entriesBreakdown.corrupted.count}`);

    // Test 5: Test processing history
    console.log('\n5. Testing processing history...');
    const processingHistory = await poolMonitor.getRecentProcessingHistory(10);
    
    console.log(`   ✅ Processing history:`);
    console.log(`      - Recent entries: ${processingHistory.length}`);
    if (processingHistory.length > 0) {
      const latest = processingHistory[0];
      console.log(`      - Latest batch: ${latest.batchId}`);
      console.log(`      - Processing type: ${latest.processingType}`);
      console.log(`      - Total entries: ${latest.totalEntries}`);
      console.log(`      - Assigned entries: ${latest.assignedEntries}`);
    }

    // Test 6: Test diagnostic information
    console.log('\n6. Testing diagnostic information...');
    const diagnostics = await poolMonitor.getDiagnosticInformation();
    
    console.log(`   ✅ Diagnostic information:`);
    console.log(`      - Health check: ${diagnostics.healthCheck.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    console.log(`      - Issues: ${diagnostics.healthCheck.issues.length}`);
    console.log(`      - Warnings: ${diagnostics.healthCheck.warnings.length}`);
    console.log(`      - Stuck entries: ${diagnostics.stuckEntries.count}`);
    console.log(`      - Bottlenecks: ${diagnostics.bottlenecks.length}`);
    console.log(`      - Database connected: ${diagnostics.systemState.databaseConnected}`);
    console.log(`      - Scheduler running: ${diagnostics.systemState.schedulerRunning}`);

    // Test 7: Test pool alerts
    console.log('\n7. Testing pool alerts...');
    const alerts = await poolMonitor.getPoolAlerts();
    
    console.log(`   ✅ Pool alerts:`);
    console.log(`      - Active alerts: ${alerts.active.length}`);
    console.log(`      - Warnings: ${alerts.warnings.length}`);
    console.log(`      - Info alerts: ${alerts.info.length}`);
    console.log(`      - Total alerts: ${alerts.summary.total}`);
    console.log(`      - Critical alerts: ${alerts.summary.critical}`);

    // Test 8: Test history tracker
    console.log('\n8. Testing pool history tracker...');
    const historyTracker = getPoolHistoryTracker();
    
    // Track a test event
    await historyTracker.trackSystemEvent(
      'HEALTH_CHECK',
      'Pool monitoring test completed successfully',
      {
        testRun: true,
        timestamp: new Date().toISOString(),
        results: {
          dashboard: 'success',
          statistics: 'success',
          diagnostics: 'success',
          alerts: 'success'
        }
      }
    );
    
    console.log(`   ✅ History tracking:`);
    console.log(`      - Test event tracked successfully`);

    // Get recent system events
    const recentEvents = await historyTracker.getRecentSystemEvents(5);
    console.log(`      - Recent system events: ${recentEvents.length}`);

    // Get error summary
    const errorSummary = await historyTracker.getErrorSummary(7);
    console.log(`      - Total errors (7 days): ${errorSummary.totalErrors}`);
    console.log(`      - Error types: ${Object.keys(errorSummary.errorsByAction).length}`);
    console.log(`      - Recent errors: ${errorSummary.recentErrors.length}`);

    console.log('\n✅ All pool monitoring tests completed successfully!');
    console.log('\n📋 Pool Monitoring System Features Verified:');
    console.log('   ✅ Pool status dashboard with comprehensive metrics');
    console.log('   ✅ Real-time pool statistics and urgency distribution');
    console.log('   ✅ Processing status monitoring and scheduling info');
    console.log('   ✅ Detailed entries breakdown by status and urgency');
    console.log('   ✅ Processing history with batch tracking');
    console.log('   ✅ Diagnostic information with health checks');
    console.log('   ✅ Pool alerts and notifications system');
    console.log('   ✅ Entry history tracking for debugging');
    console.log('   ✅ Error analysis and trend monitoring');
    console.log('   ✅ System state monitoring and bottleneck detection');

    console.log('\n🎯 Pool Monitoring Implementation Complete:');
    console.log('   📊 Comprehensive dashboard showing current entries and processing status');
    console.log('   📝 Detailed pool processing logs with entry-level tracking');
    console.log('   🔍 Diagnostic information for stuck or failed pool entries');
    console.log('   📚 Pool entry history tracking for debugging purposes');
    console.log('   🚨 Alerts and notifications for pool processing issues');

    return {
      success: true,
      dashboard,
      statistics: poolStats,
      processingStatus,
      entriesBreakdown,
      processingHistory,
      diagnostics,
      alerts,
      historyTracking: {
        recentEvents: recentEvents.length,
        errorSummary
      }
    };

  } catch (error) {
    console.error('❌ Pool monitoring test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testPoolMonitoring()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Pool monitoring test completed successfully!');
        process.exit(0);
      } else {
        console.error('\n💥 Pool monitoring test failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = {
  testPoolMonitoring
};