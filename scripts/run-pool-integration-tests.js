/**
 * Master Pool Processing Integration Test Runner
 * 
 * Orchestrates all pool processing integration tests including:
 * - End-to-end workflows
 * - Database error scenarios
 * - Mode switching
 * - Performance testing
 * - Reliability testing
 * - Failure scenarios
 */

const { PoolProcessingIntegrationTests } = require('./test-pool-processing-integration');
const { PoolProcessingPerformanceTests } = require('./test-pool-processing-performance');
const { PoolProcessingReliabilityTests } = require('./test-pool-processing-reliability');

class MasterPoolIntegrationTestRunner {
  constructor() {
    this.testSuites = [];
    this.overallResults = {
      startTime: Date.now(),
      endTime: null,
      totalDuration: 0,
      suiteResults: [],
      overallPassed: false,
      summary: {
        totalSuites: 0,
        passedSuites: 0,
        failedSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0
      }
    };
  }

  /**
   * Run all integration test suites
   */
  async runAllIntegrationTests() {
    console.log('🚀 Starting Master Pool Processing Integration Test Suite...\n');
    console.log('=' .repeat(80));
    console.log('COMPREHENSIVE POOL PROCESSING INTEGRATION TESTS');
    console.log('=' .repeat(80));
    console.log('This test suite validates all aspects of pool processing:');
    console.log('• End-to-end pool processing workflows');
    console.log('• Database error scenarios and recovery');
    console.log('• Mode switching with active pool entries');
    console.log('• Performance under high load conditions');
    console.log('• Reliability with concurrent processing');
    console.log('• Failure scenario handling');
    console.log('=' .repeat(80));
    console.log();

    try {
      // Test Suite 1: Core Integration Tests
      await this.runTestSuite(
        'Core Integration Tests',
        'Comprehensive end-to-end pool processing workflows',
        async () => {
          const suite = new PoolProcessingIntegrationTests();
          await suite.runAllTests();
          return this.extractIntegrationResults(suite);
        }
      );

      // Test Suite 2: Performance Tests
      await this.runTestSuite(
        'Performance Tests',
        'Pool processing performance under various load conditions',
        async () => {
          const suite = new PoolProcessingPerformanceTests();
          await suite.runPerformanceTests();
          return this.extractPerformanceResults(suite);
        }
      );

      // Test Suite 3: Reliability Tests
      await this.runTestSuite(
        'Reliability Tests',
        'Concurrent processing and failure scenario reliability',
        async () => {
          const suite = new PoolProcessingReliabilityTests();
          await suite.runReliabilityTests();
          return this.extractReliabilityResults(suite);
        }
      );

      // Generate comprehensive report
      await this.generateMasterReport();

    } catch (error) {
      console.error('💥 Master integration test suite failed:', error);
      this.overallResults.overallPassed = false;
      throw error;
    } finally {
      this.overallResults.endTime = Date.now();
      this.overallResults.totalDuration = this.overallResults.endTime - this.overallResults.startTime;
    }
  }

  /**
   * Run a specific test suite with error handling and reporting
   */
  async runTestSuite(suiteName, description, testFunction) {
    console.log(`\n🧪 Running ${suiteName}...`);
    console.log(`📋 ${description}`);
    console.log('-' .repeat(60));

    const suiteStart = Date.now();
    let suiteResult = {
      name: suiteName,
      description,
      startTime: suiteStart,
      endTime: null,
      duration: 0,
      passed: false,
      error: null,
      testResults: [],
      metrics: {}
    };

    try {
      const results = await testFunction();
      suiteResult.testResults = results.tests || [];
      suiteResult.metrics = results.metrics || {};
      suiteResult.passed = results.passed;
      suiteResult.endTime = Date.now();
      suiteResult.duration = suiteResult.endTime - suiteStart;

      console.log(`✅ ${suiteName} completed successfully in ${(suiteResult.duration / 1000).toFixed(2)}s`);

    } catch (error) {
      suiteResult.passed = false;
      suiteResult.error = error.message;
      suiteResult.endTime = Date.now();
      suiteResult.duration = suiteResult.endTime - suiteStart;

      console.error(`❌ ${suiteName} failed:`, error.message);
      console.log(`⏱️ Failed after ${(suiteResult.duration / 1000).toFixed(2)}s`);
    }

    this.overallResults.suiteResults.push(suiteResult);
    this.updateOverallSummary(suiteResult);

    return suiteResult;
  }

  /**
   * Extract results from integration test suite
   */
  extractIntegrationResults(suite) {
    const testResults = suite.testResults || [];
    const passedTests = testResults.filter(t => t.passed).length;
    
    return {
      passed: passedTests === testResults.length,
      tests: testResults,
      metrics: {
        totalTests: testResults.length,
        passedTests,
        failedTests: testResults.length - passedTests,
        testTypes: {
          endToEnd: testResults.filter(t => t.testName.includes('End-to-End')).length,
          databaseError: testResults.filter(t => t.testName.includes('Database Error')).length,
          modeSwitching: testResults.filter(t => t.testName.includes('Mode Switching')).length,
          highLoad: testResults.filter(t => t.testName.includes('High Load')).length,
          concurrent: testResults.filter(t => t.testName.includes('Concurrent')).length,
          failureHandling: testResults.filter(t => t.testName.includes('Failure')).length
        }
      }
    };
  }

  /**
   * Extract results from performance test suite
   */
  extractPerformanceResults(suite) {
    const performanceMetrics = suite.performanceMetrics || [];
    
    // Analyze performance metrics
    const queryPerformance = performanceMetrics.filter(m => m.testName === 'Database Query Performance');
    const bulkPerformance = performanceMetrics.filter(m => m.testName === 'Bulk Pool Operations');
    const concurrentPerformance = performanceMetrics.filter(m => m.testName === 'Concurrent Processing Performance');
    const memoryUsage = performanceMetrics.filter(m => m.testName === 'Memory Usage Under Load');
    const scalability = performanceMetrics.filter(m => m.testName === 'Scalability Limits');

    // Determine if performance is acceptable
    const performancePassed = this.evaluatePerformanceMetrics(performanceMetrics);

    return {
      passed: performancePassed,
      tests: performanceMetrics.map(m => ({
        testName: m.testName,
        passed: true, // Performance tests don't fail, they just report metrics
        duration: 0,
        details: m.metrics
      })),
      metrics: {
        totalMetrics: performanceMetrics.length,
        queryPerformanceTests: queryPerformance.length,
        bulkOperationTests: bulkPerformance.length,
        concurrentTests: concurrentPerformance.length,
        memoryTests: memoryUsage.length,
        scalabilityTests: scalability.length,
        performanceScore: this.calculatePerformanceScore(performanceMetrics)
      }
    };
  }

  /**
   * Extract results from reliability test suite
   */
  extractReliabilityResults(suite) {
    const reliabilityResults = suite.reliabilityResults || [];
    const passedTests = reliabilityResults.filter(r => r.passed).length;
    
    return {
      passed: passedTests === reliabilityResults.length,
      tests: reliabilityResults,
      metrics: {
        totalTests: reliabilityResults.length,
        passedTests,
        failedTests: reliabilityResults.length - passedTests,
        reliabilityScore: (passedTests / reliabilityResults.length) * 100,
        testTypes: {
          raceCondition: reliabilityResults.filter(r => r.testName.includes('Race Condition')).length,
          databaseFailure: reliabilityResults.filter(r => r.testName.includes('Database Connection')).length,
          modeSwitching: reliabilityResults.filter(r => r.testName.includes('Mode Switching')).length,
          interruption: reliabilityResults.filter(r => r.testName.includes('Interruption')).length,
          consistency: reliabilityResults.filter(r => r.testName.includes('Consistency')).length,
          deadlock: reliabilityResults.filter(r => r.testName.includes('Deadlock')).length
        }
      }
    };
  }

  /**
   * Evaluate if performance metrics meet acceptable thresholds
   */
  evaluatePerformanceMetrics(metrics) {
    // Define performance thresholds
    const thresholds = {
      maxQueryTime: 1000, // 1 second
      minThroughput: 10, // 10 operations per second
      maxMemoryPerEntry: 1, // 1MB per entry
      maxScaleTime: 5000 // 5 seconds for large operations
    };

    let performanceIssues = 0;

    for (const metric of metrics) {
      switch (metric.testName) {
        case 'Database Query Performance':
          // Check if any query takes too long
          Object.values(metric.metrics || {}).forEach(queryMetrics => {
            if (queryMetrics.avgTime > thresholds.maxQueryTime) {
              performanceIssues++;
            }
          });
          break;

        case 'Bulk Pool Operations':
          // Check throughput
          if (metric.metrics.addThroughput < thresholds.minThroughput ||
              metric.metrics.updateThroughput < thresholds.minThroughput ||
              metric.metrics.removeThroughput < thresholds.minThroughput) {
            performanceIssues++;
          }
          break;

        case 'Memory Usage Under Load':
          // Check memory usage per entry
          if (metric.metrics.memoryPerEntry > thresholds.maxMemoryPerEntry) {
            performanceIssues++;
          }
          break;

        case 'Scalability Limits':
          // Check if operations complete in reasonable time
          Object.values(metric.metrics.scaleTests || {}).forEach(test => {
            if (test.duration > thresholds.maxScaleTime) {
              performanceIssues++;
            }
          });
          break;
      }
    }

    // Performance is acceptable if less than 20% of metrics exceed thresholds
    return performanceIssues < metrics.length * 0.2;
  }

  /**
   * Calculate overall performance score
   */
  calculatePerformanceScore(metrics) {
    if (metrics.length === 0) return 0;

    let totalScore = 0;
    let scoreCount = 0;

    for (const metric of metrics) {
      switch (metric.testName) {
        case 'Database Query Performance':
          // Score based on query times (lower is better)
          Object.values(metric.metrics || {}).forEach(queryMetrics => {
            const score = Math.max(0, 100 - (queryMetrics.avgTime / 10)); // 10ms = 1 point deduction
            totalScore += Math.min(100, score);
            scoreCount++;
          });
          break;

        case 'Bulk Pool Operations':
          // Score based on throughput (higher is better)
          const avgThroughput = (
            metric.metrics.addThroughput +
            metric.metrics.updateThroughput +
            metric.metrics.removeThroughput
          ) / 3;
          totalScore += Math.min(100, avgThroughput * 2); // 50 ops/sec = 100 points
          scoreCount++;
          break;

        case 'Concurrent Processing Performance':
          // Score based on throughput
          totalScore += Math.min(100, metric.metrics.throughput * 2);
          scoreCount++;
          break;
      }
    }

    return scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
  }

  /**
   * Update overall summary with suite results
   */
  updateOverallSummary(suiteResult) {
    this.overallResults.summary.totalSuites++;
    
    if (suiteResult.passed) {
      this.overallResults.summary.passedSuites++;
    } else {
      this.overallResults.summary.failedSuites++;
    }

    // Count individual tests
    const testCount = suiteResult.testResults.length;
    const passedTestCount = suiteResult.testResults.filter(t => t.passed).length;
    
    this.overallResults.summary.totalTests += testCount;
    this.overallResults.summary.passedTests += passedTestCount;
    this.overallResults.summary.failedTests += (testCount - passedTestCount);
  }

  /**
   * Generate comprehensive master report
   */
  async generateMasterReport() {
    console.log('\n' + '=' .repeat(80));
    console.log('📊 MASTER POOL PROCESSING INTEGRATION TEST REPORT');
    console.log('=' .repeat(80));

    const { summary } = this.overallResults;
    const totalDurationSec = (this.overallResults.totalDuration / 1000).toFixed(2);
    const overallSuccessRate = summary.totalTests > 0 ? 
      ((summary.passedTests / summary.totalTests) * 100).toFixed(1) : 0;

    // Overall Summary
    console.log('\n🎯 OVERALL SUMMARY:');
    console.log(`Total Duration: ${totalDurationSec}s`);
    console.log(`Test Suites: ${summary.passedSuites}/${summary.totalSuites} passed`);
    console.log(`Individual Tests: ${summary.passedTests}/${summary.totalTests} passed`);
    console.log(`Overall Success Rate: ${overallSuccessRate}%`);

    // Suite-by-suite breakdown
    console.log('\n📋 SUITE BREAKDOWN:');
    this.overallResults.suiteResults.forEach((suite, index) => {
      const status = suite.passed ? '✅' : '❌';
      const duration = (suite.duration / 1000).toFixed(2);
      const testCount = suite.testResults.length;
      const passedCount = suite.testResults.filter(t => t.passed).length;

      console.log(`\n${index + 1}. ${suite.name} ${status}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Tests: ${passedCount}/${testCount} passed`);
      console.log(`   Description: ${suite.description}`);

      if (suite.error) {
        console.log(`   Error: ${suite.error}`);
      }

      // Suite-specific metrics
      if (suite.metrics && Object.keys(suite.metrics).length > 0) {
        console.log('   Key Metrics:');
        this.printSuiteMetrics(suite.metrics, '     ');
      }
    });

    // Performance Summary
    const performanceSuite = this.overallResults.suiteResults.find(s => s.name === 'Performance Tests');
    if (performanceSuite && performanceSuite.metrics) {
      console.log('\n⚡ PERFORMANCE SUMMARY:');
      console.log(`   Performance Score: ${performanceSuite.metrics.performanceScore}/100`);
      console.log(`   Query Performance Tests: ${performanceSuite.metrics.queryPerformanceTests}`);
      console.log(`   Bulk Operation Tests: ${performanceSuite.metrics.bulkOperationTests}`);
      console.log(`   Concurrent Processing Tests: ${performanceSuite.metrics.concurrentTests}`);
      console.log(`   Memory Usage Tests: ${performanceSuite.metrics.memoryTests}`);
      console.log(`   Scalability Tests: ${performanceSuite.metrics.scalabilityTests}`);
    }

    // Reliability Summary
    const reliabilitySuite = this.overallResults.suiteResults.find(s => s.name === 'Reliability Tests');
    if (reliabilitySuite && reliabilitySuite.metrics) {
      console.log('\n🔒 RELIABILITY SUMMARY:');
      console.log(`   Reliability Score: ${reliabilitySuite.metrics.reliabilityScore.toFixed(1)}%`);
      console.log(`   Race Condition Tests: ${reliabilitySuite.metrics.testTypes.raceCondition}`);
      console.log(`   Database Failure Tests: ${reliabilitySuite.metrics.testTypes.databaseFailure}`);
      console.log(`   Mode Switching Tests: ${reliabilitySuite.metrics.testTypes.modeSwitching}`);
      console.log(`   Interruption Recovery Tests: ${reliabilitySuite.metrics.testTypes.interruption}`);
      console.log(`   Data Consistency Tests: ${reliabilitySuite.metrics.testTypes.consistency}`);
      console.log(`   Deadlock Prevention Tests: ${reliabilitySuite.metrics.testTypes.deadlock}`);
    }

    // Integration Coverage Summary
    const integrationSuite = this.overallResults.suiteResults.find(s => s.name === 'Core Integration Tests');
    if (integrationSuite && integrationSuite.metrics) {
      console.log('\n🔄 INTEGRATION COVERAGE:');
      console.log(`   End-to-End Workflow Tests: ${integrationSuite.metrics.testTypes.endToEnd}`);
      console.log(`   Database Error Recovery Tests: ${integrationSuite.metrics.testTypes.databaseError}`);
      console.log(`   Mode Switching Tests: ${integrationSuite.metrics.testTypes.modeSwitching}`);
      console.log(`   High Load Tests: ${integrationSuite.metrics.testTypes.highLoad}`);
      console.log(`   Concurrent Processing Tests: ${integrationSuite.metrics.testTypes.concurrent}`);
      console.log(`   Failure Handling Tests: ${integrationSuite.metrics.testTypes.failureHandling}`);
    }

    // Final Assessment
    console.log('\n🏆 FINAL ASSESSMENT:');
    
    const allSuitesPassed = summary.failedSuites === 0;
    const highSuccessRate = parseFloat(overallSuccessRate) >= 95;
    const goodPerformance = performanceSuite ? performanceSuite.metrics.performanceScore >= 70 : true;
    const goodReliability = reliabilitySuite ? reliabilitySuite.metrics.reliabilityScore >= 90 : true;

    this.overallResults.overallPassed = allSuitesPassed && highSuccessRate && goodPerformance && goodReliability;

    if (this.overallResults.overallPassed) {
      console.log('✅ POOL PROCESSING SYSTEM: FULLY VALIDATED');
      console.log('   All integration tests passed successfully.');
      console.log('   System demonstrates high performance and reliability.');
      console.log('   Ready for production deployment.');
    } else {
      console.log('❌ POOL PROCESSING SYSTEM: VALIDATION ISSUES DETECTED');
      
      if (!allSuitesPassed) {
        console.log('   ⚠️ One or more test suites failed completely.');
      }
      if (!highSuccessRate) {
        console.log(`   ⚠️ Success rate (${overallSuccessRate}%) below 95% threshold.`);
      }
      if (!goodPerformance) {
        console.log(`   ⚠️ Performance score (${performanceSuite?.metrics.performanceScore || 0}) below 70 threshold.`);
      }
      if (!goodReliability) {
        console.log(`   ⚠️ Reliability score (${reliabilitySuite?.metrics.reliabilityScore.toFixed(1) || 0}%) below 90% threshold.`);
      }
      
      console.log('   Review failed tests and address issues before deployment.');
    }

    console.log('\n' + '=' .repeat(80));
    console.log('Integration testing completed.');
    console.log('=' .repeat(80));

    // Exit with appropriate code
    if (!this.overallResults.overallPassed) {
      process.exit(1);
    }
  }

  /**
   * Print suite metrics recursively
   */
  printSuiteMetrics(obj, indent = '') {
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        console.log(`${indent}${key}:`);
        this.printSuiteMetrics(value, indent + '  ');
      } else {
        console.log(`${indent}${key}: ${JSON.stringify(value)}`);
      }
    });
  }
}

// Main execution function
async function runMasterIntegrationTests() {
  const masterRunner = new MasterPoolIntegrationTestRunner();
  
  try {
    await masterRunner.runAllIntegrationTests();
    console.log('\n🎉 All integration tests completed successfully!');
  } catch (error) {
    console.error('\n💥 Master integration test suite failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runMasterIntegrationTests().catch(console.error);
}

module.exports = { MasterPoolIntegrationTestRunner };