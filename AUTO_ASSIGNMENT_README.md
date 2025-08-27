# Interpreter Auto-Assignment System

This document describes the implementation of the scoring-based auto-assignment engine for interpreters in the booking system.

## Overview

The auto-assignment system automatically assigns interpreters to bookings using a sophisticated scoring algorithm that balances fairness, urgency, and workload distribution. It operates immediately after a booking is created or updated.

## Core Features

- **Hard Fairness Guardrail**: Ensures no assignment exceeds the maximum hour gap between interpreters
- **Multi-Factor Scoring**: Combines fairness, urgency, and least-recently-served metrics
- **Configurable Parameters**: Admin-adjustable weights and thresholds
- **Audit Logging**: Complete decision history for transparency and debugging
- **Kill Switch**: Master toggle to disable the entire system

## How It Works

### 1. Hard Filter (Guardrail)
Before scoring, the system applies a hard filter to ensure fairness:
- Simulates assignment to each candidate
- Calculates the resulting hour gap: `max(hours) - min(hours)`
- Only keeps candidates where `gap ≤ maxGapHours`

### 2. Scoring Algorithm
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

### 3. Selection & Tie-Breaking
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

## Database Schema

### AutoAssignmentConfig
Single row configuration table with all parameters and kill switch.

### AssignmentLog
Audit trail for every assignment decision:
- Pre/post hour snapshots
- Score breakdowns
- Assignment status and reasons
- Configuration used

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

### Diagnostic Panel
- Manual assignment testing
- Score breakdown visualization
- Candidate eligibility analysis

## Safety Features

- **Idempotency**: Multiple calls for same booking won't assign multiple interpreters
- **Transaction Safety**: Assignment and logging happen atomically
- **Graceful Degradation**: System escalates instead of crashing
- **Audit Trail**: Complete decision history for debugging

## Monitoring & Debugging

### Assignment Logs
Check `AssignmentLog` table for:
- Which interpreter was assigned and why
- Pre/post hour distributions
- Score breakdowns
- Escalation reasons

### Common Escalation Reasons
- `"auto-assign disabled"` - System turned off
- `"no eligible under maxGapHours"` - All assignments would exceed fairness limit
- `"no active interpreters found"` - No interpreters available
- `"already assigned"` - Booking already has interpreter

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

## Troubleshooting

### Common Issues

#### Assignment Not Happening
- Check `autoAssignEnabled` in config
- Verify interpreters have `INTERPRETER` role
- Check assignment logs for errors

#### Unexpected Assignments
- Review score breakdowns in logs
- Check current hour distributions
- Verify configuration parameters

#### Performance Issues
- Consider reducing `fairnessWindowDays`
- Add database indexes on assignment logs
- Cache hour aggregates if needed

## Future Enhancements

- **Availability Calendar**: Consider interpreter availability schedules
- **Skill Matching**: Match interpreter skills to meeting requirements
- **Load Balancing**: More sophisticated workload distribution
- **Machine Learning**: Learn from assignment patterns

## Security Notes

- Configuration endpoints are admin-only
- Assignment logs provide full audit trail
- No sensitive data exposed in scoring
- System fails safely (escalates instead of crashes)
