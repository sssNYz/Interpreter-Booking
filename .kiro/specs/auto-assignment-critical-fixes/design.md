# Design Document

## Overview

This design addresses critical bugs in the auto-assignment system that are preventing proper operation. The solution focuses on four main areas: implementing database-persistent pool storage, fixing pool processing execution, resolving database schema and logging errors, and implementing proper mode switching with pool handling. The design maintains the existing architecture while adding reliability, persistence, monitoring, and error handling improvements.

## Critical Pool Persistence Fix

The current pool system stores data in memory (Map), causing data loss on server restarts. This design implements database persistence using the existing BookingPlan table with additional pool-related fields, ensuring data survives server restarts and supports multiple server instances.

## Architecture

### Current System Components

The auto-assignment system consists of several key components:

- **Assignment Engine** (`lib/assignment/run.ts`) - Main assignment logic and orchestration
- **Pool Manager** (`lib/assignment/pool.ts`) - Manages booking pool and processing logic
- **Logging System** (`lib/assignment/logging.ts`) - Enhanced logging with database persistence
- **Policy Engine** (`lib/assignment/policy.ts`) - Configuration and business rules
- **Database Schema** (`prisma/schema.prisma`) - Data persistence layer

### Critical Issues Identified

1. **Pool Data Persistence**: Pool stored in memory causes data loss on server restart/deployment
2. **Pool Processing Execution**: Bookings are added to pool but never processed for assignment
3. **Database Schema Errors**: Missing or incorrect database table references causing logging failures
4. **Mode Switching**: Existing pooled bookings not handled when switching from Balance to Urgent mode

## Components and Interfaces

### 1. Database-Persistent Pool Storage

#### Current Issues
- Pool stored in memory (Map) loses data on server restart
- Multiple server instances have inconsistent pool state
- No persistence across deployments
- Cannot recover from system failures

#### Design Solution

**BookingPlan Table Enhancement**
```sql
-- Add pool-related fields to existing BookingPlan table
ALTER TABLE BOOKING_PLAN ADD COLUMN POOL_STATUS ENUM('waiting', 'ready', 'processing', 'failed');
ALTER TABLE BOOKING_PLAN ADD COLUMN POOL_ENTRY_TIME DATETIME;
ALTER TABLE BOOKING_PLAN ADD COLUMN POOL_DEADLINE_TIME DATETIME;
ALTER TABLE BOOKING_PLAN ADD COLUMN POOL_PROCESSING_ATTEMPTS INT DEFAULT 0;

-- Add indexes for pool queries
CREATE INDEX idx_pool_status ON BOOKING_PLAN(POOL_STATUS);
CREATE INDEX idx_pool_deadline ON BOOKING_PLAN(POOL_DEADLINE_TIME);
CREATE INDEX idx_pool_ready ON BOOKING_PLAN(POOL_STATUS, POOL_DEADLINE_TIME);
```

**Database Pool Manager**
```typescript
interface DatabasePoolManager {
  // Pool operations using BookingPlan table
  addToPool(bookingId: number, deadlineTime: Date): Promise<void>;
  getReadyForAssignment(): Promise<BookingPlan[]>;
  markAsProcessing(bookingId: number): Promise<void>;
  removeFromPool(bookingId: number): Promise<void>;
  
  // Pool status and monitoring
  getPoolStats(): Promise<PoolStats>;
  getFailedEntries(): Promise<BookingPlan[]>;
  retryFailedEntries(): Promise<void>;
}

interface PoolStats {
  totalInPool: number;
  readyForProcessing: number;
  currentlyProcessing: number;
  failedEntries: number;
  oldestEntry: Date;
}
```

#### Implementation Strategy
1. **Database Schema Update**: Add pool fields to BookingPlan table
2. **Pool Manager Refactor**: Replace memory Map with database queries
3. **Migration Strategy**: Handle existing in-memory pool data during transition
4. **Performance Optimization**: Add proper indexes for pool queries

### 2. Pool Processing Engine Enhancement

#### Current Issues
- Pool entries are created but not processed by scheduled jobs
- No automatic processing when bookings reach thresholds
- Missing integration between pool processing and assignment execution

#### Design Solution

**Daily Pool Processing Scheduler**
```typescript
interface PoolProcessingEngine {
  // Core processing methods using database
  processReadyEntries(): Promise<ProcessingResult[]>;
  processDeadlineEntries(): Promise<ProcessingResult[]>;
  processEmergencyOverride(): Promise<ProcessingResult[]>;
  
  // Daily scheduling (runs on server startup)
  initializeDailyScheduler(): void;
  runDailyPoolCheck(): Promise<DailyProcessingResult>;
  
  // Pool database operations
  queryReadyBookings(): Promise<BookingPlan[]>;
  updatePoolStatus(bookingId: number, status: PoolStatus): Promise<void>;
  
  // Mode-specific processing
  handleModeSwitch(newMode: AssignmentMode, oldMode: AssignmentMode): Promise<void>;
}

interface DailyProcessingResult {
  processedCount: number;
  assignedCount: number;
  escalatedCount: number;
  failedCount: number;
  processingTime: number;
  nextScheduledRun: Date;
}

interface ProcessingResult {
  bookingId: number;
  status: 'assigned' | 'escalated' | 'failed';
  interpreterId?: string;
  reason: string;
  processingTime: number;
}

interface PoolProcessingStatus {
  isRunning: boolean;
  lastProcessingTime: Date;
  nextProcessingTime: Date;
  poolSize: number;
  readyForProcessing: number;
  processingErrors: ProcessingError[];
}
```

#### Implementation Strategy
1. **Daily Scheduling**: Run pool processing once daily on server startup (npm run dev)
2. **Database Queries**: Query BookingPlan table for pooled bookings ready for processing
3. **Threshold Logic**: Check poolDeadlineTime against current date for ready bookings
4. **Status Tracking**: Update poolStatus field to track processing state
5. **Error Recovery**: Retry logic with exponential backoff for failed processing

### 2. Database Schema and Logging Fixes

#### Current Issues
- `prisma.dRPolicyLog.create()` fails with "Cannot read properties of undefined"
- Missing database table mappings in Prisma client
- Logging buffer flushes failing and blocking assignment operations

#### Design Solution

**Database Schema Validation**
```typescript
interface SchemaValidator {
  validateRequiredTables(): Promise<ValidationResult>;
  validateTableStructure(tableName: string): Promise<StructureValidation>;
  repairMissingTables(): Promise<RepairResult>;
}

interface ValidationResult {
  isValid: boolean;
  missingTables: string[];
  structureIssues: StructureIssue[];
  recommendations: string[];
}
```

**Resilient Logging System**
```typescript
interface ResilientLogger {
  // Core logging with fallback
  logWithFallback<T>(
    primaryLog: () => Promise<T>,
    fallbackLog: (error: Error) => Promise<void>
  ): Promise<T | null>;
  
  // Buffer management
  flushBuffersWithRetry(maxRetries: number): Promise<FlushResult>;
  clearCorruptedBuffers(): Promise<void>;
  
  // Error handling
  handleLoggingError(error: Error, context: LoggingContext): Promise<void>;
}
```

#### Implementation Strategy
1. **Schema Validation**: Add startup validation to check required tables exist
2. **Graceful Degradation**: Continue assignment operations even when logging fails
3. **Error Isolation**: Prevent logging errors from blocking assignment execution
4. **Retry Logic**: Implement exponential backoff for database operations

### 3. Mode Switching with Pool Handling

#### Current Issues
- Switching from Balance to Urgent mode doesn't process existing pooled bookings
- No mechanism to re-evaluate pooled bookings under new mode rules
- Mode changes don't trigger immediate processing of urgent entries

#### Design Solution

**Mode Transition Manager**
```typescript
interface ModeTransitionManager {
  switchMode(newMode: AssignmentMode): Promise<ModeTransitionResult>;
  handlePooledBookingsOnSwitch(
    newMode: AssignmentMode, 
    oldMode: AssignmentMode
  ): Promise<PoolTransitionResult>;
  validateModeSwitch(newMode: AssignmentMode): Promise<ValidationResult>;
}

interface ModeTransitionResult {
  success: boolean;
  oldMode: AssignmentMode;
  newMode: AssignmentMode;
  pooledBookingsAffected: number;
  immediateAssignments: number;
  errors: TransitionError[];
}

interface PoolTransitionResult {
  processedEntries: number;
  immediateAssignments: number;
  remainingInPool: number;
  escalatedEntries: number;
  processingDetails: PoolTransitionDetail[];
}
```

#### Implementation Strategy
1. **Transition Hooks**: Add mode change event handlers to process pool entries
2. **Urgency Re-evaluation**: Re-assess pooled bookings against new mode criteria
3. **Immediate Processing**: Process urgent entries immediately on mode switch
4. **State Consistency**: Ensure pool state remains consistent during transitions

### 4. Auto-Approval Function

#### Design Solution

**Auto-Approval Engine**
```typescript
interface AutoApprovalEngine {
  // Core auto-approval logic
  evaluateSystemLoad(): Promise<SystemLoadAssessment>;
  determineOptimalMode(): Promise<AssignmentMode>;
  executeAutoSwitch(targetMode: AssignmentMode): Promise<AutoSwitchResult>;
  
  // Configuration and monitoring
  configureAutoApproval(config: AutoApprovalConfig): Promise<void>;
  getAutoApprovalStatus(): AutoApprovalStatus;
  
  // Manual override
  enableManualOverride(reason: string): Promise<void>;
  disableManualOverride(): Promise<void>;
}

interface SystemLoadAssessment {
  poolSize: number;
  averageProcessingTime: number;
  conflictRate: number;
  escalationRate: number;
  recommendedMode: AssignmentMode;
  confidence: number;
}

interface AutoApprovalConfig {
  enabled: boolean;
  evaluationIntervalMs: number;
  loadThresholds: {
    highLoad: LoadThreshold;
    normalLoad: LoadThreshold;
  };
  modePreferences: ModePreference[];
}
```

## Data Models

### Enhanced Pool Entry Model
```typescript
interface EnhancedPoolEntry {
  bookingId: number;
  meetingType: string;
  startTime: Date;
  endTime: Date;
  mode: AssignmentMode;
  thresholdDays: number;
  deadlineTime: Date;
  processingPriority: number;
  
  // Processing tracking
  processingAttempts: number;
  lastProcessingAttempt?: Date;
  processingErrors: ProcessingError[];
  
  // Status tracking
  status: 'pending' | 'ready' | 'processing' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}
```

### Pool Processing Log Model
```typescript
interface PoolProcessingLogEntry {
  batchId: string;
  mode: AssignmentMode;
  processingStartTime: Date;
  processingEndTime: Date;
  
  // Processing results
  totalEntries: number;
  processedEntries: number;
  assignedEntries: number;
  escalatedEntries: number;
  failedEntries: number;
  
  // Performance metrics
  averageProcessingTimeMs: number;
  systemLoad: 'HIGH' | 'MEDIUM' | 'LOW';
  fairnessImprovement?: number;
  
  // Error tracking
  errors: ProcessingError[];
  performance: PerformanceMetrics;
}
```

## Error Handling

### Database Error Recovery
1. **Connection Resilience**: Automatic reconnection with exponential backoff
2. **Transaction Safety**: Proper transaction handling with rollback on failures
3. **Schema Validation**: Startup validation with repair recommendations
4. **Graceful Degradation**: Continue core operations when logging fails

### Pool Processing Error Recovery
1. **Entry-Level Retry**: Individual entry retry with exponential backoff
2. **Batch Recovery**: Partial batch processing with error isolation
3. **Corruption Detection**: Identify and handle corrupted pool entries
4. **Fallback Processing**: Emergency processing when normal processing fails

### Mode Switching Error Recovery
1. **Rollback Capability**: Revert to previous mode if switch fails
2. **State Consistency**: Ensure pool state remains valid during failures
3. **Partial Success Handling**: Handle cases where some entries process successfully
4. **User Notification**: Clear feedback about switch success/failure

## Testing Strategy

### Unit Testing
- Pool processing engine components
- Database error handling and recovery
- Mode switching logic
- Auto-approval decision making

### Integration Testing
- End-to-end pool processing workflows
- Database schema validation and repair
- Mode switching with active pool entries
- Error recovery scenarios

### Performance Testing
- Pool processing under high load
- Database operation performance
- Mode switching response times
- Auto-approval system responsiveness

### Reliability Testing
- Database connection failures
- Partial system failures
- Concurrent processing scenarios
- Long-running pool processing

## Implementation Phases

### Phase 1: Critical Bug Fixes (Immediate)
1. Fix pool processing execution
2. Resolve database schema errors
3. Implement basic mode switching with pool handling
4. Add essential error handling

### Phase 2: Reliability Improvements (Short-term)
1. Enhanced error recovery
2. Pool processing monitoring
3. Database resilience improvements
4. Performance optimizations

### Phase 3: Advanced Features (Medium-term)
1. Auto-approval function
2. Advanced monitoring and diagnostics
3. Configuration validation
4. Emergency processing capabilities

## Monitoring and Observability

### Key Metrics
- Pool processing success rate
- Average processing time per entry
- Database operation success rate
- Mode switching frequency and success
- Auto-approval decision accuracy

### Logging Strategy
- Structured logging with correlation IDs
- Performance metrics collection
- Error tracking with context
- Pool state change auditing

### Alerting
- Pool processing failures
- Database connection issues
- Mode switching problems
- Auto-approval anomalies

## Security Considerations

### Data Protection
- Secure handling of booking and interpreter data
- Audit logging for all assignment decisions
- Access control for emergency processing functions

### System Integrity
- Validation of pool entry data
- Protection against pool corruption
- Safe mode switching with validation

### Error Information
- Sanitized error messages in logs
- Secure error reporting
- Protected diagnostic information