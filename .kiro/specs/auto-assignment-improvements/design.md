# Design Document

## Overview

This design document outlines the improvements to the existing auto-assignment system for interpreter booking. The system will be enhanced to handle concurrent bookings, improve DR meeting assignment rules, implement better assignment modes with pool integration, and provide a more robust user interface. The design maintains the existing codebase structure while adding new capabilities and fixing critical issues.

## Architecture

### Current System Components
The existing system consists of several key modules:
- `lib/assignment/run.ts` - Main assignment orchestration
- `lib/assignment/policy.ts` - Configuration and policy management
- `lib/assignment/dr-history.ts` - DR meeting assignment tracking
- `lib/assignment/pool.ts` - Booking pool management (referenced but not shown)
- `lib/assignment/fairness.ts` - Fairness scoring (referenced but not shown)
- `lib/assignment/scoring.ts` - Candidate scoring (referenced but not shown)

### Enhanced Architecture Components

#### 1. Conflict Detection Layer
A new conflict detection system will be integrated into the assignment flow to prevent time overlaps:

```typescript
interface ConflictDetector {
  checkTimeConflicts(interpreterId: string, startTime: Date, endTime: Date): Promise<boolean>;
  getAvailableInterpreters(startTime: Date, endTime: Date): Promise<string[]>;
  validateAssignment(interpreterId: string, bookingId: number): Promise<boolean>;
}
```

#### 2. Enhanced DR History Management
The existing DR history system will be improved to handle fairness windows and dynamic interpreter pools:

```typescript
interface EnhancedDRHistory {
  getLastGlobalDRAssignment(before: Date, options?: DRHistoryOptions): Promise<LastGlobalDRAssignment>;
  checkConsecutiveHistory(interpreterId: string, params: ConsecutiveCheckParams): Promise<ConsecutiveDRAssignmentHistory>;
  adjustForDynamicPool(interpreterPool: string[], fairnessWindow: number): Promise<void>;
}
```

#### 3. Pool Management Enhancement
The pool system will be enhanced to support different assignment modes:

```typescript
interface EnhancedPoolManager {
  addToPool(booking: BookingInfo, mode: AssignmentMode): Promise<PoolEntry>;
  processPoolByMode(mode: AssignmentMode): Promise<ProcessResult[]>;
  getPoolStatus(): Promise<PoolStatus>;
  validatePoolIntegrity(): Promise<ValidationResult>;
}
```

## Components and Interfaces

### 1. Conflict Detection Component

**Location**: `lib/assignment/conflict-detection.ts`

**Purpose**: Prevent double-booking of interpreters by checking time overlaps before assignment.

**Key Methods**:
- `checkInterpreterAvailability()` - Check if interpreter is free during specified time
- `getConflictingBookings()` - Get list of conflicting bookings for an interpreter
- `filterAvailableInterpreters()` - Remove unavailable interpreters from candidate pool

**Integration Points**:
- Called before scoring in `performAssignment()`
- Used in pool processing to validate assignments
- Integrated with database transactions for race condition prevention

### 2. Enhanced Assignment Flow

**Location**: `lib/assignment/run.ts` (modified)

**Key Changes**:
- Add conflict detection before candidate scoring
- Implement database-level locking for concurrent assignments
- Enhanced error handling and retry logic
- Improved logging for conflict resolution

**New Flow**:
1. Load booking and policy
2. Check urgency and pool requirements
3. **NEW**: Filter interpreters by availability (conflict detection)
4. Calculate scores for available interpreters only
5. **NEW**: Validate final assignment before database update
6. Assign with transaction safety

### 3. DR History Improvements

**Location**: `lib/assignment/dr-history.ts` (enhanced)

**Key Enhancements**:
- Fairness window integration for consecutive tracking
- Dynamic interpreter pool adjustment
- Mode-specific DR policies
- Better handling of new/removed interpreters

**New Features**:
- `adjustConsecutiveHistoryForNewInterpreters()` - Handle new interpreters fairly
- `cleanupHistoryForRemovedInterpreters()` - Maintain data integrity
- `getFairnessAdjustedHistory()` - Adjust history for dynamic pools

### 4. Mode-Specific Pool Processing

**Location**: `lib/assignment/pool.ts` (enhanced)

**Balance Mode Enhancements**:
- Delayed assignment until threshold days
- Batch processing for optimal fairness
- Workload distribution optimization
- Deadline override mechanisms

**Urgent Mode Enhancements**:
- Immediate assignment prioritization
- Minimal fairness constraints
- Fast conflict resolution
- Emergency assignment protocols

**Normal Mode Enhancements**:
- Balanced immediate vs. fairness considerations
- Standard conflict handling
- Regular pool processing intervals

### 5. Configuration Management

**Location**: `lib/assignment/policy.ts` (enhanced)

**New Validation Features**:
- Parameter range validation with warnings
- Mode-specific constraint enforcement
- Real-time configuration impact assessment
- Safe default fallbacks

**Enhanced Mode Management**:
- Dynamic mode switching with validation
- Mode-specific parameter locking
- Configuration history tracking
- Impact prediction for changes

## Data Models

### Enhanced Conflict Detection Models

```typescript
interface TimeConflict {
  interpreterId: string;
  conflictingBookingId: number;
  conflictStart: Date;
  conflictEnd: Date;
  conflictType: 'OVERLAP' | 'ADJACENT' | 'CONTAINED';
}

interface AvailabilityCheck {
  interpreterId: string;
  requestedStart: Date;
  requestedEnd: Date;
  isAvailable: boolean;
  conflicts: TimeConflict[];
  bufferViolations?: BufferViolation[];
}
```

### Enhanced Pool Management Models

```typescript
interface PoolEntry {
  bookingId: number;
  meetingType: string;
  startTime: Date;
  endTime: Date;
  priorityValue: number;
  poolEntryTime: Date;
  decisionWindowTime: Date;
  mode: AssignmentMode;
  urgencyOverride?: boolean;
}

interface PoolProcessingResult {
  processedCount: number;
  assignedCount: number;
  escalatedCount: number;
  remainingCount: number;
  processingMode: AssignmentMode;
  batchId: string;
}
```

### Enhanced DR History Models

```typescript
interface FairnessAdjustedDRHistory {
  interpreterId: string;
  adjustedConsecutiveCount: number;
  fairnessWindowStart: Date;
  poolAdjustmentFactor: number;
  isNewInterpreter: boolean;
  effectiveHistory: DRAssignment[];
}

interface DRPolicyResult {
  isBlocked: boolean;
  penaltyApplied: boolean;
  penaltyAmount: number;
  policyReason: string;
  overrideAvailable: boolean;
}
```

## Error Handling

### Conflict Resolution Strategy

1. **Detection Phase**: Identify conflicts before scoring
2. **Prevention Phase**: Filter out conflicted interpreters
3. **Resolution Phase**: Handle edge cases and race conditions
4. **Recovery Phase**: Retry with next best candidates
5. **Escalation Phase**: Human intervention when no resolution possible

### DR Assignment Fallbacks

1. **Primary**: Apply mode-specific DR policies
2. **Secondary**: Relax consecutive restrictions if no alternatives
3. **Tertiary**: Override all restrictions for critical coverage
4. **Emergency**: Manual assignment notification

### Pool Processing Error Handling

1. **Validation Errors**: Remove invalid entries and log
2. **Assignment Failures**: Retry with updated candidate pool
3. **Timeout Errors**: Escalate urgent bookings immediately
4. **System Errors**: Graceful degradation to manual assignment

## Testing Strategy

### Unit Testing Focus Areas

1. **Conflict Detection Logic**
   - Time overlap calculations
   - Edge cases (adjacent bookings, timezone handling)
   - Race condition simulation
   - Database transaction testing

2. **DR History Management**
   - Consecutive assignment tracking
   - Fairness window calculations
   - Dynamic pool adjustments
   - Mode-specific policy application

3. **Pool Management**
   - Mode-specific processing logic
   - Threshold and deadline handling
   - Batch processing optimization
   - Error recovery mechanisms

### Integration Testing Scenarios

1. **Concurrent Booking Simulation**
   - Multiple simultaneous assignment requests
   - Database locking verification
   - Conflict resolution validation
   - Performance under load

2. **DR Assignment Scenarios**
   - Consecutive assignment prevention
   - Emergency override situations
   - Mode switching during active assignments
   - Fairness window boundary conditions

3. **Pool Processing Workflows**
   - Mode-specific batch processing
   - Deadline-driven escalations
   - Cross-mode consistency
   - Configuration change impacts

### Performance Testing

1. **Scalability Testing**
   - Large interpreter pools (100+ interpreters)
   - High booking volumes (1000+ daily bookings)
   - Complex scheduling scenarios
   - Memory and CPU usage optimization

2. **Concurrency Testing**
   - Simultaneous assignment requests
   - Database connection pooling
   - Lock contention handling
   - Deadlock prevention

## Security Considerations

### Data Access Control
- Interpreter availability data protection
- Assignment history privacy
- Configuration change auditing
- User role-based access to assignment controls

### System Integrity
- Database transaction safety
- Configuration validation to prevent system abuse
- Audit trails for all assignment decisions
- Rollback capabilities for erroneous assignments

### Performance Security
- Rate limiting for assignment requests
- Resource usage monitoring
- Denial of service prevention
- Graceful degradation under attack

## Migration Strategy

### Phase 1: Conflict Detection Implementation
- Add conflict detection without changing existing flow
- Implement logging and monitoring
- Gradual rollout with fallback mechanisms

### Phase 2: DR History Enhancement
- Enhance existing DR history functions
- Maintain backward compatibility
- Add new fairness window features

### Phase 3: Pool Management Improvements
- Enhance pool processing with mode-specific logic
- Implement batch processing optimizations
- Add comprehensive monitoring

### Phase 4: UI and Configuration Enhancements
- Implement new configuration interface
- Add real-time validation and warnings
- Provide migration tools for existing configurations

### Phase 5: Full System Integration
- Complete integration testing
- Performance optimization
- Documentation and training materials
- Production deployment with monitoring