# Interpreter Auto-Assignment System

This document describes the implementation of the scoring-based auto-assignment engine for interpreters in the booking system.

## Overview

The auto-assignment system automatically assigns interpreters to bookings using a sophisticated scoring algorithm that balances fairness, urgency, and workload distribution. It operates immediately after a booking is created or updated.

## Core Features

- **Hard Fairness Guardrail**: Ensures no assignment exceeds the maximum hour gap between interpreters
- **Multi-Factor Scoring**: Combines fairness, urgency, and least-recently-served metrics
- **DR Meeting Protection**: Advanced logic to prevent interpreter burnout from consecutive DR assignments
- **Configurable Parameters**: Admin-adjustable weights and thresholds
- **Audit Logging**: Complete decision history for transparency and debugging
- **Kill Switch**: Master toggle to disable the entire system

## How It Works

### 1. Hard Filter (Guardrail)
Before scoring, the system applies a hard filter to ensure fairness:
- Simulates assignment to each candidate
- Calculates the resulting hour gap: `max(hours) - min(hours)`
- Only keeps candidates where `gap ≤ maxGapHours`

### 2. DR Meeting Special Logic
For DR (disaster/emergency) meetings, the system applies additional protection:

#### Consecutive Assignment Check (Hard Filter)
- Before scoring, query the BOOKING_PLAN table for the interpreter's two most recent DR assignments
- If both of the last two DR assignments were for this interpreter, immediately disqualify them
- This is a non-negotiable rule to prevent burnout
- The function returns a disqualified status with the reason `ConsecutiveDRBlocked`

#### Scoring Penalty (Dynamic Soft Filter)
- If only the single most recent assignment was a DR booking, do not disqualify the interpreter
- Instead, apply a penalty to their final score
- The penalty value is configurable via the `drConsecutivePenalty` parameter
- This makes them less favorable while keeping them as a last-resort option

### 3. Scoring Algorithm
For eligible candidates, the system computes three scores (0-1 range):

#### Fairness Score
```
gap_i = H_i - min(H_j)
FairnessScore_i = clamp(1 - gap_i / maxGapHours, 0, 1)
```
- Higher score = fewer hours relative to others
- Prevents workload imbalance

#### Urgency Score
```
daysUntil = floor((startTime - now) / 1 day)
UrgencyScore = clamp((minAdvanceDays - daysUntil) / minAdvanceDays, 0, 1)
```
- Higher score = closer to start time
- Same for all candidates in a given booking

#### LRS Score (Least Recently Served)
```
LRSScore_i = clamp(daysSinceLastAssignment_i / fairnessWindowDays, 0, 1)
```
- Higher score = longer since last assignment
- Ensures fair rotation among interpreters

#### Total Score
```
Total_i = w_fair × FairnessScore_i + w_urgency × UrgencyScore + w_lrs × LRSScore_i
```

#### DR Penalty Application
```
if (isDRMeeting && penaltyApplied) {
  FinalScore_i = max(0, Total_i + drConsecutivePenalty)
}
```

### 4. Selection & Tie-Breaking
- Candidates ranked by total score (highest first)
- Ties broken by LRS score (least-recently-served wins)
- Small seeded random jitter for final tie-breaking

## Configuration Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `autoAssignEnabled` | `true` | boolean | Master kill switch |
| `fairnessWindowDays` | `30` | 7-90 | Rolling window for hour calculations |
| `maxGapHours` | `10` | 1-100 | Maximum allowed hour difference |
| `minAdvanceDays` | `2` | 0-30 | Days before urgency scoring starts |
| `w_fair` | `1.2` | 0-5 | Fairness score weight |
| `w_urgency` | `0.5` | 0-5 | Urgency score weight |
| `w_lrs` | `0.3` | 0-5 | LRS score weight |
| `drConsecutivePenalty` | `-0.7` | -2.0 to 0 | Penalty for consecutive DR assignments |

## DR Assignment Logic Details

### Why DR Meetings Need Special Handling
DR (disaster/emergency) meetings are high-stress assignments that can lead to interpreter burnout if assigned consecutively to the same person. The system implements a two-tier protection mechanism:

1. **Hard Block (2+ consecutive)**: Interpreters with 2 or more consecutive DR assignments are automatically disqualified
2. **Soft Penalty (1 consecutive)**: Interpreters with 1 consecutive DR assignment receive a score penalty but remain eligible

### Implementation Benefits
- **99% Prevention**: Most DR meetings will be automatically assigned to different interpreters
- **Fallback Safety**: In rare cases where no other interpreters are available, the system can still assign to a "penalized" interpreter
- **Burnout Prevention**: Hard limit prevents the worst-case scenario of 3+ consecutive DR assignments
- **No Schema Changes**: Uses existing database structure and history

### Example Scenarios

#### Scenario 1: Normal DR Assignment
- Interpreter A has no recent DR assignments
- Interpreter B has 1 recent DR assignment (penalty applied)
- Interpreter C has 2 recent DR assignments (blocked)
- Result: Interpreter A gets the assignment (highest score)

#### Scenario 2: Limited Availability
- Only Interpreter B is available (1 recent DR assignment)
- Penalty is applied but assignment still occurs
- Result: Interpreter B gets the assignment with penalty

#### Scenario 3: Emergency Fallback
- Only Interpreter C is available (2+ recent DR assignments)
- System blocks assignment and escalates
- Result: Manual intervention required

## Database Schema

### AutoAssignmentConfig
Single row configuration table with all parameters and kill switch, including the new `drConsecutivePenalty` field.

### AssignmentLog
Audit trail for every assignment decision:
- Pre/post hour snapshots
- Score breakdowns
- Assignment status and reasons
- Configuration used
- DR assignment history (when applicable)

## API Endpoints

### Admin Configuration
- `GET /api/admin/config/auto-assign` - Read current configuration
- `PUT /api/admin/config/auto-assign` - Update configuration

### Manual Assignment
- `POST /api/assignment/run` - Manually run assignment for a booking

## Integration Points

The system automatically triggers when:
1. A new booking is created without an interpreter
2. A booking is updated (if auto-assignment is enabled)

## Admin Interface

### Configuration Panel
- Interactive sliders for all parameters
- Real-time validation and feedback
- Kill switch toggle
- **New**: DR consecutive penalty slider (-2.0 to 0.0)

### Diagnostic Panel
- Manual assignment testing
- Score breakdown visualization
- Candidate eligibility analysis
- DR assignment history display

## Safety Features

- **Idempotency**: Multiple calls for same booking won't assign multiple interpreters
- **Transaction Safety**: Assignment and logging happen atomically
- **Graceful Degradation**: System escalates instead of crashing
- **Audit Trail**: Complete decision history for debugging
- **DR Protection**: Automatic burnout prevention for high-stress assignments

## Monitoring & Debugging

### Assignment Logs
Check `AssignmentLog` table for:
- Which interpreter was assigned and why
- Pre/post hour distributions
- Score breakdowns
- Escalation reasons
- DR assignment history (when applicable)

### Common Escalation Reasons
- `"auto-assign disabled"` - System turned off
- `"no eligible under maxGapHours"` - All assignments would exceed fairness limit
- `"no active interpreters found"` - No interpreters available
- `"already assigned"` - Booking already has interpreter
- `"ConsecutiveDRBlocked"` - Interpreter blocked due to consecutive DR assignments

### DR Assignment Monitoring
- Check for `ConsecutiveDRBlocked` reasons in assignment logs
- Monitor penalty applications in score breakdowns
- Track DR assignment patterns over time

## Tuning Guidelines

### For Better Fairness
- Increase `w_fair` weight
- Decrease `maxGapHours`
- Increase `fairnessWindowDays`

### For Better Urgency Response
- Increase `w_urgency` weight
- Decrease `minAdvanceDays`

### For Better Rotation
- Increase `w_lrs` weight
- Increase `fairnessWindowDays`

### For DR Assignment Control
- Adjust `drConsecutivePenalty` based on team size and DR frequency
- More negative values (-1.0 to -2.0) create stronger rotation
- Less negative values (-0.3 to -0.7) allow more flexibility

## Testing

### Manual Testing
1. Create a booking without interpreter
2. Check auto-assignment result
3. Review assignment log
4. Use diagnostic panel for analysis

### Test Cases
1. **Hard Filter**: Create scenarios where some interpreters exceed gap limit
2. **Urgency**: Test bookings near deadline vs. far in future
3. **LRS**: Verify least-recently-served gets priority
4. **No Candidates**: Ensure graceful escalation
5. **DR Consecutive Logic**: Test with interpreters having different DR assignment histories
6. **DR Penalty Application**: Verify penalties are correctly applied and logged

### DR-Specific Test Scenarios
1. **Fresh Interpreter**: No recent DR assignments (should get highest score)
2. **One Consecutive**: 1 recent DR assignment (penalty applied, still eligible)
3. **Two Consecutive**: 2+ recent DR assignments (blocked, ineligible)
4. **Mixed Availability**: Test with limited interpreter pool

## Troubleshooting

### Common Issues

#### Assignment Not Happening
- Check `autoAssignEnabled` in config
- Verify interpreters have `INTERPRETER` role
- Check assignment logs for errors
- Look for `ConsecutiveDRBlocked` reasons in DR meetings

#### Unexpected Assignments
- Review score breakdowns in logs
- Check current hour distributions
- Verify configuration parameters
- Examine DR assignment history for penalties

#### Performance Issues
- Consider reducing `fairnessWindowDays`
- Add database indexes on assignment logs
- Cache hour aggregates if needed

#### DR Assignment Issues
- Verify `drConsecutivePenalty` is configured correctly
- Check DR assignment history in logs
- Ensure meeting type is correctly identified as "DR"

## Future Enhancements

- **Availability Calendar**: Consider interpreter availability schedules
- **Skill Matching**: Match interpreter skills to meeting requirements
- **Load Balancing**: More sophisticated workload distribution
- **Machine Learning**: Learn from assignment patterns
- **DR Fatigue Metrics**: Track and visualize DR assignment patterns
- **Team Rotation Policies**: Configurable rotation rules for different meeting types

## Security Notes

- Configuration endpoints are admin-only
- Assignment logs provide full audit trail
- No sensitive data exposed in scoring
- System fails safely (escalates instead of crashes)
- DR assignment history is logged for transparency
