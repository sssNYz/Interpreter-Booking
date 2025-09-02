# Koro GuideBook: Auto-Approve / Auto-Assignment System

## 0. Overview

The auto-assignment system automatically assigns interpreters to bookings. It uses smart scoring to balance fairness, urgency, and workload. The system can assign immediately or put bookings in a pool to wait.

### What the System Does

- **Auto-Approve**: When an interpreter is assigned, booking status changes to "approve"
- **Auto-Assignment**: Picks the best interpreter using scores
- **Pool System**: Stores non-urgent bookings until their decision window

### Key Policies

- **Mode**: BALANCE (fair), URGENT (fast), NORMAL (balanced), CUSTOM (configurable)
- **Fairness**: Max gap between interpreter hours (default: 5 hours)
- **LRS**: Least Recently Served - gives priority to interpreters who haven't worked recently
- **DR Rule**: Special rules for disaster/emergency meetings to prevent burnout

### High-Level Flow

```
[Booking Created]
     ↓
loadPolicy() → fetchBooking() → shouldAssignImmediately()?
     ↓                                    ↓
     ↓                               NO → addToPool() → [sleep] → processPool()
     ↓                                                              ↓
     ↓ ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
     ↓
    YES → prepareCandidates() → eligibility(fairness)
     ↓                              ↓
     ↓                         computeScores(fair/urgency/LRS)
     ↓                              ↓
     ↓                         getLastGlobalDR(≤ booking time)
     ↓                              ↓
     ↓                         apply DR policy(block/penalty)
     ↓                              ↓
     ↓                         total + jitter → rank → assign → log
     ↓                              ↓
     ↓ ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
     ↓
[Assignment Complete]
```

## 1. Entry → Decision

### 1.1 Entry Point

**Purpose**: Start assignment for a booking
**Trigger**: API call to `/api/assignment/run` with bookingId
**Where in code**: `lib/assignment/run.ts:runAssignment()`

**Inputs prepared**:
- bookingId (number)

**Decision rules**:
- Load policy first
- Check if auto-assignment is enabled
- Get booking details

**Side effects**:
- Console log: "🚀 Starting assignment for booking X"

### 1.2 Load Policy

**Purpose**: Get current assignment rules and weights
**Trigger**: Called at start of assignment
**Where in code**: `lib/assignment/policy.ts:loadPolicy()`

**Inputs prepared**:
- Database config from `autoAssignmentConfig` table

**Decision rules**:
- Use database config if exists
- Create default config if none exists
- Clamp values to safe ranges
- Apply mode-specific defaults for non-CUSTOM modes

**Side effects**:
- Creates default config in database if missing

### 1.3 Fetch Booking

**Purpose**: Get booking details and check if already assigned
**Trigger**: After policy is loaded
**Where in code**: `lib/assignment/run.ts:runAssignment()`

**Inputs prepared**:
- bookingId, timeStart, timeEnd, meetingType, interpreterEmpCode

**Decision rules**:
- Return "already assigned" if interpreterEmpCode exists
- Return "booking not found" if booking doesn't exist

**Side effects**:
- Console log if already assigned or not found

### 1.4 Urgency Gate

**Purpose**: Decide immediate assignment vs pool
**Trigger**: After booking is fetched
**Where in code**: `lib/assignment/pool.ts:shouldAssignImmediately()`

**Inputs prepared**:
- startTime, meetingType
- Meeting type priority from database

**Decision rules**:
- Get meeting type priority configuration
- Calculate days until booking starts
- Compare with urgentThresholdDays
- If daysUntil ≤ urgentThresholdDays → immediate
- Else → pool

**Side effects**:
- Console log: "📥 Booking X is not urgent, adding to pool" OR "⚡ Booking X is urgent"

## 2. Scoring & Selection (Immediate Path)

### 2.1 Get Eligible Candidates

**Purpose**: Find interpreters who won't break fairness rules
**Trigger**: When immediate assignment is needed
**Where in code**: `lib/assignment/fairness.ts:getActiveInterpreters()`

**Inputs prepared**:
- Active interpreters with INTERPRETER role
- Current hours for each interpreter

**Decision rules**:
- Get all active interpreters
- Simulate +1 hour assignment to each
- Calculate max gap - min gap
- Keep only candidates where gap ≤ maxGapHours

**Side effects**:
- Return "no active interpreters found" if none available
- Return "no eligible under maxGapHours" if all exceed gap

### 2.2 Prepare Features

**Purpose**: Calculate current state for scoring
**Where in code**: `lib/assignment/fairness.ts:getInterpreterHours()`

**Variables prepared**:

| Name | Source | Type | Example |
|------|--------|------|---------|
| currentHours | Database bookings in window | number | 15.5 |
| minHours | Min from all interpreters | number | 10.0 |
| daysSinceLastAssignment | Assignment logs | number | 5.2 |
| urgencyScore | Time + meeting type | number | 0.75 |

### 2.3 Fairness Score

**Purpose**: Reward interpreters with fewer hours
**Where in code**: `lib/assignment/fairness.ts:computeFairnessScore()`

**Formula**:
```
gap_i = interpreterHours - minHours
FairnessScore = max(0, 1 - gap_i / maxGapHours)
```

**Why**: Higher score = fewer hours = more fair

### 2.4 Urgency Score

**Purpose**: Prioritize bookings close to start time
**Where in code**: `lib/assignment/urgency.ts:computeEnhancedUrgencyScore()`

**Formula**:
```
daysUntil = floor((startTime - now) / 1 day)
if daysUntil ≤ minAdvanceDays:
  timeScore = pow(2, (minAdvanceDays - daysUntil) / 2)
  urgencyScore = min(1.0, priorityValue * timeScore / 100)
else:
  urgencyScore = 0.0
```

**Why**: Same for all candidates in one booking, but varies by meeting type priority

### 2.5 LRS Score (Least Recently Served)

**Purpose**: Rotate assignments fairly
**Where in code**: `lib/assignment/lrs.ts:computeLRSScore()`

**Formula**:
```
daysSinceLast = (now - lastAssignmentTime) / 1 day
LRSScore = min(1.0, daysSinceLast / fairnessWindowDays)
```

**Why**: Higher score = longer since last assignment = should get priority

### 2.6 DR Consecutive Logic (Critical)

**Purpose**: Prevent interpreter burnout from consecutive DR assignments
**Where in code**: `lib/assignment/dr-history.ts:checkDRAssignmentHistory()`

**Process**:
1. **Fetch lastGlobalDR once per booking** (timeStart ≤ booking start)
2. **Check if consecutive**: `lastGlobalDR.interpreterEmpCode === candidateId`
3. **Apply policy**:
   - If `forbidConsecutive = true` → block candidate (reason: ConsecutiveDRBlocked)
   - If `forbidConsecutive = false` → apply penalty to score

**DR Policy by Mode**:
- **BALANCE**: Hard block (`forbidConsecutive: true`)
- **URGENT**: Soft penalty (`consecutivePenalty: -0.1`)
- **NORMAL**: Soft penalty (`consecutivePenalty: -0.5`)
- **CUSTOM**: Configurable

**WATCH OUT**: Only the interpreter who did the LAST DR is blocked/penalized, not based on counts in a window.

### 2.7 Total Score Calculation

**Purpose**: Combine all scores with mode-specific weights
**Where in code**: `lib/assignment/scoring.ts:computeTotalScore()`

**Formula**:
```
Total = w_fair × FairnessScore + w_urgency × UrgencyScore + w_lrs × LRSScore

If DR penalty applies:
  FinalScore = max(0, Total + drConsecutivePenalty)
```

**Mode Weights**:
- **BALANCE**: w_fair=2.0, w_urgency=0.6, w_lrs=0.6
- **URGENT**: w_fair=0.5, w_urgency=2.5, w_lrs=0.2  
- **NORMAL**: w_fair=1.2, w_urgency=0.8, w_lrs=0.3
- **CUSTOM**: User-defined

### 2.8 Tie-Breaking

**Purpose**: Ensure deterministic selection when scores are equal
**Where in code**: `lib/assignment/scoring.ts:addJitter()`

**Process**:
1. Add small seeded jitter based on interpreter ID (-0.001 to +0.001)
2. Sort by total score (highest first)
3. If still tied, use LRS score as secondary sort

**Why**: Prevents random selection, ensures consistent results

### 2.9 Winner Assignment

**Purpose**: Update database and log decision
**Where in code**: `lib/assignment/run.ts:performAssignment()`

**DB Updates**:
```sql
UPDATE bookingPlan SET 
  interpreterEmpCode = winner.empCode,
  bookingStatus = 'approve'  -- Business rule: auto-approve when assigned
WHERE bookingId = X
```

**Logging**: Creates record in `assignmentLog` with scores, snapshots, and reasons

**Side effects**:
- Console log: "✅ Successfully assigned booking X to Y"
- Score breakdown logged

## 3. Pool Lifecycle (Deferred Assignment)

### 3.1 When to Pool

**Purpose**: Store non-urgent bookings for later processing
**Trigger**: When `shouldAssignImmediately()` returns false
**Where in code**: `lib/assignment/pool.ts:addToPool()`

**Conditions**:
- daysUntil > urgentThresholdDays
- Before decision window

**What we store**:
- bookingId, meetingType, startTime, endTime
- priorityValue, urgentThresholdDays, generalThresholdDays
- poolEntryTime, decisionWindowTime

**Decision window calculation**:
```
decisionWindowTime = now + generalThresholdDays * 24 hours
```

### 3.2 Wake-up Cycle

**Purpose**: Process pool entries that are ready for assignment
**Trigger**: Periodic calls to `processPool()` or manual trigger
**Where in code**: `lib/assignment/run.ts:processPool()`

**Selection logic**:
```
readyEntries = entries where decisionWindowTime ≤ now
```

**Ordering**: Sort by priority (highest first), then by decision window time

### 3.3 Pool Re-evaluation

**Purpose**: Apply same assignment logic to pooled bookings
**Process**:
1. Get current booking details
2. Check if already assigned (remove from pool if yes)
3. Re-run `performAssignment()` with current policy
4. Remove from pool if assignment successful

**Concurrency notes**:
- Use ≤ for last DR comparison to handle same-timestamp bookings
- Process entries in stable order (sorted by time)

## 4. Policies & Variables

### 4.1 Policy Knobs

**Where loaded**: `lib/assignment/policy.ts:loadPolicy()`

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `autoAssignEnabled` | `true` | boolean | Master kill switch |
| `mode` | `'NORMAL'` | BALANCE/URGENT/NORMAL/CUSTOM | Assignment strategy |
| `fairnessWindowDays` | `30` | 7-90 | Rolling window for hour calculations |
| `maxGapHours` | `5` | 1-100 | Maximum allowed hour difference |
| `minAdvanceDays` | `2` | 0-30 | Days before urgency scoring starts |
| `w_fair` | `1.2` | 0-5 | Fairness score weight |
| `w_urgency` | `0.8` | 0-5 | Urgency score weight |
| `w_lrs` | `0.3` | 0-5 | LRS score weight |
| `drConsecutivePenalty` | `-0.5` | -2.0 to 0 | Penalty for consecutive DR |

### 4.2 DR Policy Fields

**Where configured**: `lib/assignment/policy.ts:getDRPolicy()`

| Field | Description | BALANCE | URGENT | NORMAL |
|-------|-------------|---------|--------|--------|
| `scope` | GLOBAL or BY_TYPE | GLOBAL | GLOBAL | GLOBAL |
| `forbidConsecutive` | Hard block vs soft penalty | true | false | false |
| `consecutivePenalty` | Penalty value | -0.8 | -0.1 | -0.5 |
| `includePendingInGlobal` | Count pending bookings | false | true | false |

### 4.3 Mode Defaults

**CUSTOM mode**: Uses configured values from database
**Other modes**: Override config with mode-specific defaults

**Safe clamps**: All values are clamped to safe ranges to prevent system errors

## 5. Data & Effects

### 5.1 Tables/Collections Touched

**Read operations**:
- `autoAssignmentConfig`: Policy settings
- `meetingTypePriority`: Meeting type configurations  
- `bookingPlan`: Booking details, assignment history
- `employee`: Active interpreters with INTERPRETER role
- `assignmentLog`: Assignment history for LRS calculation

**Write operations**:
- `bookingPlan`: Update interpreterEmpCode and bookingStatus
- `assignmentLog`: Log every assignment decision

### 5.2 What We Log

**Assignment logs include**:
- Pre/post hour snapshots
- Score breakdowns (fairness, urgency, LRS, total)
- Assignment status and reasons
- Configuration used (maxGapHours, fairnessWindowDays, mode)
- DR assignment history (when applicable)

**Console logs**:
- Assignment start/completion
- Pool operations
- DR penalty applications
- Score breakdowns for debugging

### 5.3 Error Handling

**Graceful fallbacks**:
- Return "escalated" status instead of crashing
- Use safe defaults if config missing
- Continue with available data if some queries fail

**What user/admin sees**:
- Clear error messages in API responses
- Assignment logs show escalation reasons
- Console logs for debugging

## 6. Edge Cases & Guarantees

### 6.1 Already Assigned Booking
- **Check**: `booking.interpreterEmpCode !== null`
- **Action**: Return "already assigned" status
- **Guarantee**: No double assignment

### 6.2 No Active Interpreters
- **Check**: `interpreters.length === 0`
- **Action**: Return "no active interpreters found"
- **Guarantee**: Graceful escalation

### 6.3 Everyone Fails Fairness Filter
- **Check**: `eligibleIds.length === 0`
- **Action**: Return "no eligible under maxGapHours"
- **Guarantee**: Fairness rules enforced

### 6.4 Multiple DR Bookings Same Time
- **Solution**: Use `≤` for last DR comparison, not `<`
- **Guarantee**: Stable ordering, consistent results

### 6.5 Batch Assignment Virtual Last DR
- **Process**: Within batch, update "virtual last DR" after each assignment
- **Guarantee**: Consecutive logic works within batch

### 6.6 Missing drType
- **Fallback**: Use global scope instead of BY_TYPE
- **Guarantee**: System continues to work

### 6.7 Policy Mode Mismatches
- **Solution**: Validate mode, default to NORMAL if invalid
- **Guarantee**: System uses valid configuration

### 6.8 Time-zone and Clock Skew
- **Mitigation**: Use consistent Date objects, server timezone
- **Guarantee**: Consistent time calculations

## 7. Quality Checklist

### 7.1 Determinism Maintained
- [ ] Seeded jitter uses interpreter ID for consistency
- [ ] Stable sorts with secondary criteria (LRS)
- [ ] Same inputs always produce same outputs

### 7.2 Database Efficiency
- [ ] O(1) DB queries per booking for last DR (not per candidate)
- [ ] Reuse lastGlobalDR result for all candidates
- [ ] Proper indexes on frequently queried fields

### 7.3 Logging Quality
- [ ] Logs explain why candidate was blocked/penalized
- [ ] Score breakdowns show all components
- [ ] Clear escalation reasons

### 7.4 Pool Management
- [ ] Pool recheck frequency is appropriate
- [ ] Ordering is deterministic (priority, then time)
- [ ] Cleanup of completed/assigned bookings

### 7.5 DR Logic Tests
- [ ] Block vs penalty modes work correctly
- [ ] Global vs by-type scope respected
- [ ] Batch same-time handling works
- [ ] ≤ comparison handles edge cases

### 7.6 Configuration Safety
- [ ] Value clamps prevent unsafe configurations
- [ ] Mode defaults override user settings appropriately
- [ ] Graceful handling of missing config

## 8. Mini Playbook (Debug & Improve)

### 8.1 Trace Single Booking

**Steps**:
1. Check console logs for booking ID
2. Look for assignment log entry in database
3. Review score breakdown and eligibility reasons
4. Check DR history if DR meeting

**Key logs to read**:
- "🚀 Starting assignment for booking X"
- "📊 Urgency score for Y: Z"
- "🔍 Scoring for X (Mode: Y)"
- "✅ Successfully assigned booking X to Y"

### 8.2 Verify DR No-Consecutive Behavior

**Quick test**:
1. Create two DR bookings with same start time
2. Assign first booking to interpreter A
3. Check that second booking doesn't assign to A
4. Verify logs show "ConsecutiveDRBlocked" or penalty applied

### 8.3 Tune Mode Weights

**Process**:
1. Switch to CUSTOM mode
2. Adjust w_fair, w_urgency, w_lrs values
3. Test with sample bookings
4. Review score breakdowns in logs
5. Monitor fairness gap over time

### 8.4 Simulate Pool Wake-ups

**Manual trigger**:
```bash
curl -X POST /api/assignment/process-pool
```

**Check**:
- Pool status before/after
- Which entries were processed
- Assignment results

## 9. Appendix

### 9.1 Glossary

- **Booking**: A meeting that needs an interpreter
- **Pool**: Storage for non-urgent bookings waiting for assignment
- **Policy**: Configuration rules for assignment behavior
- **Fairness**: Ensuring equal workload distribution among interpreters
- **LRS**: Least Recently Served - rotation to give everyone turns
- **DR**: Disaster/Emergency meetings requiring special handling
- **Urgent window**: Time threshold for immediate assignment
- **General window**: Time threshold for pool processing

### 9.2 Pseudo-Sequence for Immediate Assign

```
1. loadPolicy()
2. fetchBooking(bookingId)
3. if booking.interpreterEmpCode → return "already assigned"
4. if shouldAssignImmediately(startTime, meetingType) → continue
5. getActiveInterpreters()
6. getInterpreterHours(interpreters, fairnessWindowDays)
7. computeEnhancedUrgencyScore(startTime, meetingType, minAdvanceDays)
8. for each interpreter:
   a. simulate assignment → check maxGapHours
   b. if eligible → add to candidates
9. if no candidates → return "escalated"
10. if isDRMeeting → getLastGlobalDRAssignment(startTime)
11. for each candidate:
    a. computeFairnessScore()
    b. computeLRSScore()
    c. if DR → checkDRAssignmentHistory()
    d. computeTotalScore() + applyDRPenalty()
    e. addJitter()
12. sort by total score, tie-break with LRS
13. updateBooking(winner.empCode, status="approve")
14. logAssignment()
```

### 9.3 Pseudo-Sequence for Pool

```
1. addToPool(bookingId, meetingType, startTime, endTime)
2. calculateDecisionWindow(generalThresholdDays)
3. store in pool with metadata
4. [later] processPool():
   a. getReadyForAssignment() → filter by decisionWindowTime ≤ now
   b. sort by priority, then by time
   c. for each ready entry → run immediate assignment logic
   d. if assigned → removeFromPool()
```

### 9.4 Suggested Unit Tests

1. **Basic Assignment**: Normal booking, multiple candidates, verify highest score wins
2. **Fairness Filter**: Candidates that would exceed maxGapHours are excluded
3. **DR Consecutive Block**: Last DR interpreter is blocked in BALANCE mode
4. **DR Consecutive Penalty**: Last DR interpreter gets penalty in NORMAL mode
5. **Pool Lifecycle**: Non-urgent booking goes to pool, processes at decision window
6. **Mode Weights**: Different modes produce different score rankings
7. **Tie Breaking**: Equal scores use LRS, then jitter for deterministic results
8. **Edge Cases**: No candidates, already assigned, missing config

**TIP**: Test with fixed timestamps and seeded data for reproducible results.

**WATCH OUT**: DR consecutive logic only blocks/penalizes the interpreter who did the LAST DR, not based on counts in a time window.

---

*This guidebook covers the complete auto-approve/auto-assignment system flow. For questions or improvements, check the assignment logs and console output for detailed debugging inf