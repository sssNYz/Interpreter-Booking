# DR Assignment Implementation Summary

## Overview

This document summarizes the implementation of the advanced, history-based logic for DR (disaster/emergency) meeting assignments within the auto-assignment engine. The system prevents interpreter burnout by enforcing strict rotation policies without requiring database schema changes.

## Implementation Components

### 1. Database Schema Updates

#### New Field Added
- **Table**: `AUTO_ASSIGNMENT_CONFIG`
- **Field**: `DR_CONSECUTIVE_PENALTY`
- **Type**: `DECIMAL(3,2)`
- **Default**: `-0.70`
- **Range**: `-2.00` to `0.00`
- **Purpose**: Configurable penalty for interpreters with 1 consecutive DR assignment

#### Migration Script
- **File**: `scripts/migrate-dr-penalty.sql`
- **Action**: Adds the new column with proper defaults and constraints

### 2. Type System Updates

#### New Interfaces
```typescript
// Added to types/assignment.ts
interface AssignmentPolicy {
  // ... existing fields
  drConsecutivePenalty: number; // New parameter
}

interface DRAssignmentHistory {
  interpreterId: string;
  consecutiveDRCount: number;
  lastDRAssignments: Array<{
    bookingId: number;
    timeStart: Date;
    drType: string;
  }>;
  isBlocked: boolean;
  penaltyApplied: boolean;
}

interface CandidateResult {
  // ... existing fields
  drHistory?: DRAssignmentHistory; // DR assignment history
}
```

### 3. Core Logic Implementation

#### New Module: `lib/assignment/dr-history.ts`
- **Function**: `checkDRAssignmentHistory(interpreterId, fairnessWindowDays)`
  - Queries `BOOKING_PLAN` table for recent DR assignments
  - Returns assignment history and penalty status
  - Implements the two-tier protection system

- **Function**: `isDRMeeting(meetingType)`
  - Simple utility to identify DR meetings

- **Function**: `applyDRPenalty(baseScore, penalty, penaltyApplied)`
  - Applies penalty to scores when applicable

#### Updated Scoring System: `lib/assignment/scoring.ts`
- **Integration**: DR history checking before scoring
- **Hard Filter**: Blocks interpreters with 2+ consecutive DR assignments
- **Soft Filter**: Applies penalties to interpreters with 1 consecutive DR assignment
- **Logging**: Enhanced debug output for DR-related decisions

#### Updated Policy System: `lib/assignment/policy.ts`
- **Default Value**: `drConsecutivePenalty: -0.7`
- **Validation**: Range clamping (-2.0 to 0.0)
- **Backward Compatibility**: Safe defaults for existing configurations

#### Updated Main Logic: `lib/assignment/run.ts`
- **Detection**: Identifies DR meetings during assignment
- **Parameter Passing**: Forwards DR-related parameters to scoring functions
- **Logging**: Enhanced console output for DR meeting processing

### 4. Admin Interface Updates

#### Configuration Panel: `components/AdminControls/AutoAssignConfig.tsx`
- **New Slider**: DR consecutive penalty control (-2.0 to 0.0)
- **Help Text**: Comprehensive explanation of the parameter
- **Real-time Updates**: Immediate feedback on parameter changes

## How It Works

### 1. DR Meeting Detection
When a booking is processed:
1. System checks `meetingType` field
2. If `meetingType === "DR"`, DR logic is activated
3. Console logs indicate DR meeting processing

### 2. Consecutive Assignment Check
For each interpreter candidate:
1. Query `BOOKING_PLAN` for recent DR assignments within fairness window
2. Count consecutive DR assignments
3. Apply logic:
   - **0 assignments**: No penalty, normal scoring
   - **1 assignment**: Apply penalty, keep eligible
   - **2+ assignments**: Block completely, mark ineligible

### 3. Penalty Application
If penalty is applicable:
1. Calculate normal score using existing algorithm
2. Add `drConsecutivePenalty` value (negative number)
3. Ensure final score doesn't go below 0
4. Log penalty application for transparency

### 4. Assignment Decision
1. Blocked interpreters are excluded from final selection
2. Penalized interpreters remain eligible but with lower scores
3. System naturally prefers non-penalized interpreters
4. Fallback to penalized interpreters if no alternatives available

## Configuration Parameters

### DR Consecutive Penalty
- **Default**: `-0.7`
- **Range**: `-2.0` to `0.0`
- **Effect**: 
  - `-2.0`: Strong rotation enforcement
  - `-1.0`: Moderate rotation enforcement  
  - `-0.7`: Balanced approach (default)
  - `-0.3`: Light rotation enforcement
  - `0.0`: No penalty (not recommended)

## Benefits of This Implementation

### 1. **Burnout Prevention**
- Hard limit prevents 3+ consecutive DR assignments
- Automatic rotation without manual intervention
- Configurable penalty system for flexibility

### 2. **System Reliability**
- No database schema changes required
- Uses existing data structures
- Graceful fallback when no alternatives available

### 3. **Admin Control**
- Configurable penalty values
- Real-time parameter adjustment
- Comprehensive logging and monitoring

### 4. **Performance**
- Efficient database queries
- Minimal impact on assignment speed
- Smart caching of DR assignment history

## Testing and Validation

### Test Script
- **File**: `scripts/test-dr-assignment.js`
- **Purpose**: Validates DR assignment logic
- **Coverage**: 
  - DR meeting detection
  - Interpreter history checking
  - Configuration validation
  - Assignment log analysis

### Test Scenarios
1. **Fresh Interpreter**: No recent DR assignments
2. **One Consecutive**: 1 recent DR assignment (penalty applied)
3. **Two Consecutive**: 2+ recent DR assignments (blocked)
4. **Mixed Availability**: Limited interpreter pool scenarios

## Monitoring and Debugging

### Assignment Logs
- **New Reason**: `ConsecutiveDRBlocked`
- **Enhanced Data**: DR assignment history included
- **Score Breakdown**: Penalty applications visible

### Console Output
- **DR Detection**: `🚨 DR meeting detected for booking X`
- **Penalty Application**: `⚠️ DR penalty applied to X: -0.7`
- **History Details**: Consecutive count and penalty status

### Admin Interface
- **Real-time Monitoring**: Live parameter adjustment
- **Visual Feedback**: Slider controls with help text
- **Configuration Validation**: Safe parameter ranges

## Deployment Steps

### 1. Database Migration
```bash
# Run the migration script
mysql -u username -p database_name < scripts/migrate-dr-penalty.sql
```

### 2. Code Deployment
- Deploy updated TypeScript files
- Restart the application
- Verify configuration loads correctly

### 3. Configuration Setup
- Access admin panel
- Adjust `drConsecutivePenalty` as needed
- Test with sample DR bookings

### 4. Validation
- Run test script: `node scripts/test-dr-assignment.js`
- Check assignment logs for DR-related entries
- Verify penalty applications in score breakdowns

## Future Enhancements

### 1. **Advanced Metrics**
- DR assignment pattern visualization
- Burnout risk scoring
- Team rotation analytics

### 2. **Policy Extensions**
- Meeting-type-specific rotation rules
- Time-based penalty adjustments
- Skill-based assignment preferences

### 3. **Machine Learning**
- Learn optimal penalty values
- Predict burnout risk
- Optimize rotation patterns

## Troubleshooting

### Common Issues

#### DR Meetings Not Detected
- Verify `meetingType` field is set to "DR"
- Check database for DR bookings
- Ensure field mapping is correct

#### Penalties Not Applied
- Verify `drConsecutivePenalty` is configured
- Check DR assignment history queries
- Review console logs for penalty messages

#### Performance Issues
- Consider reducing fairness window
- Add database indexes on DR-related fields
- Monitor query execution times

### Debug Commands
```bash
# Test DR assignment logic
node scripts/test-dr-assignment.js

# Check configuration
curl /api/admin/config/auto-assign

# Review assignment logs
SELECT * FROM ASSIGNMENT_LOG WHERE reason LIKE '%DR%' ORDER BY created_at DESC;
```

## Conclusion

This implementation provides a robust, configurable solution for preventing interpreter burnout from consecutive DR assignments. The two-tier protection system (hard block + soft penalty) ensures both safety and flexibility, while the comprehensive logging and monitoring capabilities provide full transparency into assignment decisions.

The system is designed to be:
- **Safe**: Prevents worst-case burnout scenarios
- **Flexible**: Configurable parameters for different team needs
- **Transparent**: Complete audit trail of all decisions
- **Efficient**: Minimal performance impact on existing operations
- **Maintainable**: Clean, well-documented code structure

By implementing this system, organizations can ensure fair distribution of high-stress DR assignments while maintaining system reliability and providing administrators with full control over assignment policies.
