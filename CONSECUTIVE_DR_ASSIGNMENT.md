# Consecutive-Aware DR Assignment Implementation

## Overview

This implementation replaces the previous DR assignment logic (which used counts within a time window) with a **consecutive-aware** logic that penalizes or blocks **only the interpreter who handled the most recent DR assignment** before the booking being evaluated. This enforces "no consecutive DR for the same interpreter," promoting rotation.

## Key Changes

### 1. New Helper Function: `getLastGlobalDRAssignment`

```typescript
getLastGlobalDRAssignment(
  before: Date,
  opts?: { 
    drType?: string; 
    includePending?: boolean 
  }
): Promise<LastGlobalDRAssignment>
```

**Purpose**: Fetches the most recent DR assignment globally before a given time.

**Behavior**:
- Queries `bookingPlan` for the most recent record where `meetingType = "DR"` and `timeStart < before`
- If `opts.drType` is provided, filters by the same `drType`
- If `includePending` is true, allows `bookingStatus in ["approve","pending"]`; otherwise only `"approve"`
- Returns `{ interpreterEmpCode | null, bookingId?, timeStart?, drType? }`

### 2. Enhanced DR History Check: `checkDRAssignmentHistory`

```typescript
checkDRAssignmentHistory(
  interpreterId: string,
  fairnessWindowDays: number,
  params?: {
    bookingTimeStart?: Date;
    drType?: string;
    lastGlobalDR?: LastGlobalDRAssignment;
    includePendingInGlobal?: boolean;
    drPolicy?: DRPolicy;
  }
): Promise<ConsecutiveDRAssignmentHistory>
```

**New Logic**:
- Computes `isConsecutiveGlobal = (lastGlobalDR?.interpreterEmpCode === interpreterId)`
- **Does not** use `fairnessWindowDays` to determine consecutiveness
- Respects configurable policy to decide if `isBlocked` or `penaltyApplied` should be set when `isConsecutiveGlobal` is true

### 3. New DR Policy Configuration

```typescript
interface DRPolicy {
  scope: "GLOBAL" | "BY_TYPE";     // GLOBAL = one pool; BY_TYPE = rotate per drType
  forbidConsecutive: boolean;      // true = hard block; false = soft penalty
  consecutivePenalty: number;      // negative number applied to total score if not blocked
  includePendingInGlobal: boolean; // whether pending bookings count as "last"
}
```

**Mode-Specific Policies**:
- **BALANCE**: `forbidConsecutive: true` (hard block)
- **URGENT**: `forbidConsecutive: false`, `consecutivePenalty: -0.1`, `includePendingInGlobal: true`
- **NORMAL**: `forbidConsecutive: false`, `consecutivePenalty: -0.5`
- **CUSTOM**: Configurable values

### 4. Integration into Scoring Pipeline

**Minimal Changes**:
- At the start of evaluating a single DR booking, call `getLastGlobalDRAssignment` **once** and reuse the result for all candidates
- For each candidate, call `checkDRAssignmentHistory` with the new parameters
- If `history.isBlocked`, mark candidate as ineligible with reason `ConsecutiveDRBlocked (last by same interpreter)`
- Else if `history.penaltyApplied`, apply configurable penalty to the total score

## Implementation Details

### Database Efficiency

- **O(1) per booking**: `getLastGlobalDRAssignment` is called once per booking, not per candidate
- **Reuse results**: The last global DR assignment is computed once and reused for all candidates
- **No N×M queries**: Avoids the previous approach of querying per interpreter

### Backward Compatibility

- Existing function signatures are preserved
- New parameters are optional
- Legacy logic is maintained for non-DR meetings
- Existing `drConsecutivePenalty` parameter is still used but now controlled by policy

### Deterministic Behavior

- Seeded jitter for tie-breaking is preserved
- LRS secondary sort is maintained
- All decisions are logged for transparency

## Test Scenarios

### 1. Block Same Interpreter (GLOBAL)
- **Setup**: Last DR = `A`, booking is DR, candidates `[A,B]`, policy `forbidConsecutive=true`
- **Expected**: `A` ineligible, `B` wins

### 2. Penalty Same Interpreter (GLOBAL)
- **Setup**: Same as (1) but `forbidConsecutive=false`, `consecutivePenalty=-0.25`
- **Expected**: `A` gets penalty; if still behind, `B` wins; else tie-break applies

### 3. Scope BY_TYPE
- **Setup**: Last DR for `drType="X"` = `A`. Booking `drType="Y"`
- **Expected**: No block/penalty on `A`

### 4. No Last DR
- **Setup**: No previous DR before `booking.timeStart`
- **Expected**: No block/penalty

### 5. Batch Ordering
- **Setup**: Two DR bookings `t1 < t2`. Last DR pre-batch = `A`. At `t1`, `B` assigned
- **Expected**: Virtual last becomes `B`. At `t2`, `B` now penalized/blocked

## Configuration

### DR Policy Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `scope` | `"GLOBAL"` | `"GLOBAL" \| "BY_TYPE"` | Whether to rotate globally or per DR type |
| `forbidConsecutive` | `false` | `boolean` | Whether to hard block consecutive assignments |
| `consecutivePenalty` | `-0.7` | `-2.0` to `0.0` | Penalty applied to consecutive interpreters |
| `includePendingInGlobal` | `false` | `boolean` | Whether pending bookings count as "last" |

### Mode-Specific Defaults

```typescript
// BALANCE mode
{
  scope: "GLOBAL",
  forbidConsecutive: true,  // Hard block
  consecutivePenalty: -0.8,
  includePendingInGlobal: false
}

// URGENT mode  
{
  scope: "GLOBAL",
  forbidConsecutive: false, // Soft penalty
  consecutivePenalty: -0.1,
  includePendingInGlobal: true // Include pending
}

// NORMAL mode
{
  scope: "GLOBAL", 
  forbidConsecutive: false, // Soft penalty
  consecutivePenalty: -0.5,
  includePendingInGlobal: false
}
```

## Benefits

### 1. **True Consecutive Prevention**
- Only the interpreter who did the last DR is penalized/blocked
- Promotes genuine rotation across the interpreter pool
- Prevents burnout more effectively than time-window counting

### 2. **Performance Improvements**
- Single database query per booking instead of per candidate
- Reduced computational overhead
- Better scalability for large interpreter pools

### 3. **Flexible Configuration**
- Mode-specific policies
- Configurable penalty values
- Support for both global and type-specific rotation

### 4. **Maintainable Code**
- Clear separation of concerns
- Well-documented interfaces
- Backward compatibility preserved

## Migration Notes

### For Existing Deployments
- No database schema changes required
- Existing configurations continue to work
- New logic is opt-in via policy configuration
- Legacy behavior preserved for non-DR meetings

### For New Deployments
- Default to consecutive-aware logic
- Configure DR policies based on organizational needs
- Monitor assignment logs for policy effectiveness

## Future Enhancements

### Potential Improvements
1. **Batch Processing**: Virtual last DR pointer for multi-booking assignments
2. **DR Type Rotation**: Enhanced BY_TYPE scope with type-specific policies
3. **Advanced Penalties**: Time-based penalty decay
4. **Analytics**: Enhanced logging for policy effectiveness analysis

### Configuration UI
- Admin interface for DR policy configuration
- Real-time policy testing
- Assignment history visualization
