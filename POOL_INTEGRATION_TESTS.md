# Pool Processing Integration Tests

This document describes the comprehensive integration test suite for the pool processing system, covering end-to-end workflows, database error scenarios, mode switching, performance testing, and reliability validation.

## Overview

The pool processing integration tests validate all critical aspects of the auto-assignment system's pool functionality:

- **End-to-end pool processing workflows**
- **Database error scenarios and recovery**
- **Mode switching with active pool entries**
- **Performance under high load conditions**
- **Reliability with concurrent processing**
- **Failure scenario handling**

## Test Structure

### Test Files

1. **`scripts/run-pool-integration-tests.js`** - Master test runner
2. **`scripts/test-pool-processing-integration.js`** - Core integration tests
3. **`scripts/test-pool-processing-performance.js`** - Performance tests
4. **`scripts/test-pool-processing-reliability.js`** - Reliability tests

### Test Categories

#### 1. Core Integration Tests (`test-pool-processing-integration.js`)

**End-to-End Pool Processing Workflows**
- Pool entry creation and management
- Threshold-based processing
- Deadline processing
- Scheduler functionality
- Assignment execution

**Database Error Recovery**
- Connection resilience testing
- Transaction safety validation
- Schema validation
- Graceful degradation
- Error isolation

**Mode Switching with Pool Entries**
- Balance to Urgent mode transitions
- Pool re-evaluation logic
- Graceful mode switching during processing
- Pool entry handling across modes

**High Load Performance**
- 50+ booking pool processing
- Bulk operation performance
- Concurrent pool operations
- Performance threshold validation

**Concurrent Processing Reliability**
- Race condition handling
- Concurrent pool modifications
- Status query consistency
- Data integrity validation

**Failure Scenario Handling**
- Corrupted entry detection and cleanup
- Excessive retry handling
- Stuck processing recovery
- Emergency processing fallback

#### 2. Performance Tests (`test-pool-processing-performance.js`)

**Database Query Performance**
- Pool statistics queries at various scales (10-1000 entries)
- Ready assignment queries
- Deadline entry queries
- Failed entry queries
- Performance threshold validation (<1s for stats, <100ms per entry)

**Bulk Pool Operations**
- Bulk addition throughput testing
- Bulk status update performance
- Bulk removal operations
- Throughput measurement (ops/second)

**Concurrent Processing Performance**
- Multi-threaded processing simulation
- Concurrent operation throughput
- Thread performance analysis
- Scalability measurement

**Memory Usage Under Load**
- Memory consumption tracking
- Garbage collection impact
- Memory per entry calculation
- Memory leak detection

**Scalability Limits**
- Large-scale testing (1000-5000 entries)
- Performance degradation points
- Resource utilization analysis
- Scalability threshold identification

#### 3. Reliability Tests (`test-pool-processing-reliability.js`)

**Race Condition Handling**
- Concurrent pool modifications
- Status update conflicts
- Query consistency during modifications
- Atomic operation validation

**Database Connection Failures**
- Connection resilience testing
- Health check functionality
- Recovery processing validation
- Graceful degradation testing

**Concurrent Mode Switching**
- Multi-threaded mode changes
- Pool operation consistency during switches
- Data integrity during transitions
- Mode switch conflict resolution

**Process Interruption Recovery**
- Stuck entry detection
- Processing resumption
- Batch recovery handling
- System state consistency

**Data Consistency Under Load**
- High-concurrency data integrity
- Referential integrity validation
- Status consistency checks
- Database-memory synchronization

**Deadlock Prevention**
- Circular dependency testing
- High contention scenarios
- Transaction timeout handling
- Lock conflict resolution

## Running the Tests

### Prerequisites

1. **Database Setup**: Ensure PostgreSQL is running and accessible
2. **Environment Variables**: Configure `.env` with database connection
3. **Dependencies**: Run `npm install` to install required packages
4. **Database Schema**: Ensure latest migrations are applied

### Test Execution Commands

```bash
# Run all integration tests (recommended)
npm run test:pool-integration

# Run individual test suites
npm run test:pool-integration-core    # Core integration tests only
npm run test:pool-performance         # Performance tests only
npm run test:pool-reliability         # Reliability tests only
```

### Test Execution Options

**Full Integration Test Suite** (Recommended)
```bash
npm run test:pool-integration
```
- Runs all test categories
- Generates comprehensive report
- Takes 10-15 minutes to complete
- Validates entire system

**Individual Test Suites**
```bash
# Core functionality tests (5-7 minutes)
npm run test:pool-integration-core

# Performance benchmarking (3-5 minutes)
npm run test:pool-performance

# Reliability validation (4-6 minutes)
npm run test:pool-reliability
```

## Test Data Management

### Test Data Creation
- Tests create isolated test employees and bookings
- Uses unique prefixes to avoid conflicts (`TEST_`, `PERF_`, `REL_`)
- Creates realistic test scenarios with proper relationships

### Test Data Cleanup
- Automatic cleanup after each test suite
- Removes all test employees and bookings
- Resets pool status for any affected entries
- Ensures no test data pollution

### Database Safety
- Tests use transactions where possible
- Rollback on test failures
- Isolated test data prevents production impact
- Comprehensive cleanup on interruption

## Performance Thresholds

### Database Query Performance
- **Pool Statistics**: < 1 second
- **Entry Processing**: < 100ms per entry
- **Concurrent Operations**: < 2 seconds for 5 operations
- **Bulk Operations**: > 10 operations per second

### Memory Usage
- **Memory per Entry**: < 1MB
- **Memory Growth**: Linear with pool size
- **Garbage Collection**: Effective cleanup after operations

### Scalability Limits
- **Pool Size**: Tested up to 5,000 entries
- **Processing Time**: Linear scaling expected
- **Concurrent Users**: Up to 10 simultaneous operations

## Reliability Criteria

### Success Rates
- **Overall Test Success**: ≥ 95%
- **Race Condition Handling**: ≥ 80% (some conflicts expected)
- **Database Recovery**: 100%
- **Data Consistency**: 100%

### Error Handling
- **Graceful Degradation**: System continues operating during failures
- **Error Recovery**: Automatic recovery from transient failures
- **Data Integrity**: No data corruption under any conditions

## Test Reports

### Master Report Structure
```
MASTER POOL PROCESSING INTEGRATION TEST REPORT
===============================================

OVERALL SUMMARY:
- Total Duration: XXs
- Test Suites: X/X passed
- Individual Tests: XX/XX passed
- Overall Success Rate: XX%

SUITE BREAKDOWN:
1. Core Integration Tests ✅
   Duration: XXs
   Tests: XX/XX passed
   
2. Performance Tests ✅
   Duration: XXs
   Performance Score: XX/100
   
3. Reliability Tests ✅
   Duration: XXs
   Reliability Score: XX%

PERFORMANCE SUMMARY:
- Query Performance Tests: X
- Bulk Operation Tests: X
- Memory Usage Tests: X
- Scalability Tests: X

RELIABILITY SUMMARY:
- Race Condition Tests: X
- Database Failure Tests: X
- Data Consistency Tests: X
- Deadlock Prevention Tests: X

FINAL ASSESSMENT:
✅ POOL PROCESSING SYSTEM: FULLY VALIDATED
```

### Individual Test Details
Each test provides detailed metrics:
- Execution time
- Success/failure status
- Performance measurements
- Error details (if any)
- Specific test parameters

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Ensure PostgreSQL is running
- Check database connection string in `.env`
- Verify database exists and is accessible

**Memory Issues**
```bash
Error: JavaScript heap out of memory
```
- Increase Node.js memory limit: `node --max-old-space-size=4096`
- Run individual test suites instead of full suite
- Check for memory leaks in test data cleanup

**Test Timeouts**
```bash
Error: Test timeout after 30000ms
```
- Database may be slow or overloaded
- Reduce test data size for performance tests
- Check database performance and indexes

**Permission Errors**
```bash
Error: permission denied for table booking_plan
```
- Ensure database user has full permissions
- Check database schema ownership
- Verify migration status

### Debug Mode

Enable detailed logging by setting environment variable:
```bash
DEBUG=pool-tests npm run test:pool-integration
```

### Test Data Inspection

If tests fail, inspect remaining test data:
```sql
-- Check for test employees
SELECT * FROM employee WHERE emp_code LIKE 'TEST_%' OR emp_code LIKE 'PERF_%' OR emp_code LIKE 'REL_%';

-- Check for test bookings
SELECT * FROM booking_plan WHERE meeting_room LIKE 'TEST_%' OR meeting_room LIKE 'PERF_%' OR meeting_room LIKE 'REL_%';

-- Check pool status
SELECT pool_status, COUNT(*) FROM booking_plan WHERE pool_status IS NOT NULL GROUP BY pool_status;
```

## Continuous Integration

### CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Run Pool Integration Tests
  run: npm run test:pool-integration
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

### Test Scheduling

**Pre-deployment**: Run full integration suite
**Nightly**: Run performance and reliability tests
**On PR**: Run core integration tests

### Performance Monitoring

Track performance metrics over time:
- Query response times
- Throughput measurements
- Memory usage patterns
- Scalability limits

## Requirements Validation

These integration tests validate all requirements from the specification:

### Requirement 1: Pool Processing Execution Fix ✅
- End-to-end pool processing workflows
- Threshold-based assignment processing
- Deadline processing validation
- Scheduler functionality testing

### Requirement 2: Database Schema and Logging Fix ✅
- Database error recovery testing
- Schema validation
- Logging system reliability
- Graceful degradation validation

### Requirement 3: Mode Switching with Pool Handling ✅
- Mode transition testing
- Pool re-evaluation logic
- Graceful mode switching
- Pool entry handling across modes

### Requirement 4: Pool Status Monitoring and Debugging ✅
- Pool status query testing
- Diagnostic information validation
- Processing status monitoring
- Debug information accuracy

### Requirement 5: Auto-Approval Function Enhancement ✅
- Mode switching automation testing
- Load-based decision making
- Pool handling during auto-approval

### Requirement 6: Pool Processing Reliability ✅
- Error recovery testing
- Retry logic validation
- Corruption detection
- Fallback processing

### Requirement 7: Configuration Validation ✅
- Pool configuration testing
- Validation logic verification
- Impact assessment testing

### Requirement 8: Emergency Pool Processing Override ✅
- Emergency processing testing
- Priority-based processing
- Results reporting validation
- Audit logging verification

## Conclusion

The pool processing integration test suite provides comprehensive validation of all system components, ensuring:

- **Functional Correctness**: All features work as specified
- **Performance Adequacy**: System meets performance requirements
- **Reliability Assurance**: System handles failures gracefully
- **Data Integrity**: No data corruption under any conditions
- **Scalability Validation**: System scales to expected loads

Run these tests before any deployment to ensure system reliability and performance.