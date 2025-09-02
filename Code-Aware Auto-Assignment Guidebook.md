# Code-Aware Auto-Assignment Guidebook

## Overview

**FACT**: The auto-assignment system picks interpreters for bookings automatically.
**FACT**: When an interpreter is assigned, the booking status changes to "approve".
**FACT**: The system can assign immediately or put bookings in a pool to wait.

### What the System Does

- **Auto-Approve**: Sets `bookingStatus = 'approve'` when `interpreterEmpCode` is assigned
- **Auto-Assignment**: Uses scoring to pick the best interpreter
- **Pool System**: Stores non-urgent bookings until their decision window

### Key Policies

- **Mode**: BALANCE (fair), URGENT (fast), NORMAL (balanced), CUSTOM (configurable)
- **Fairness**: Max gap between interpreter hours (prevents overwork)
- **LRS**: Least Recently Served - gives turns to everyone
- **DR Rule**: Special rules for disaster meetings to prevent burnout

### ASCII Flow Diagram

```
[API Call] → runAssignment(bookingId)
     ↓
loadPolicy() → fetchBooking() → shouldAssignImmediately()?
     ↓                                    ↓
     ↓                               NO → addToPool() → [wait] → processPool()
     ↓                                                              ↓
     ↓ ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
     ↓
    YES → getActiveInterpreters() → fairness filter
     ↓                              ↓
     ↓                         rankByScore() → DR check
     ↓                              ↓
     ↓                         computeScores() → jitter → sort
     ↓                              ↓
     ↓                         UPDATE bookingPlan → log
     ↓                              ↓
     ↓ ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
     ↓
[Assignment Complete]
```

## Runtime Flow Walkthrough

### Step 1: Entry Point

**File**: `app/api/assignment/run/route.ts` → **Function**: `POST`

**Purpose**: API endpoint that starts assignment
**Why**: External trigger for the assignment system
**When**: Called by frontend or other services
**Inputs**: `{ bookingId: number }` in request body
**Outputs**: JSON response with assignment result
**Data touched**: None directly (delegates to main logic)

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();           // ① parse request
    const { bookingId } = body;                  // ② extract booking ID

    if (!bookingId || typeof bookingId !== 'number') {  // ③ validate
      return NextResponse.json(
        { success: false, error: "bookingId is required and must be a number" },
        { status: 400 }
      );
    }

    const result = await run(bookingId);         // ④ delegate to main logic

    return NextResponse.json({                   // ⑤ return result
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error running auto-assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to run auto-assignment" },
      { status: 500 }
    );
  }
}
```

**Step-by-step**:
① Parse JSON from request body
② Extract bookingId parameter
③ Validate bookingId is a number
④ Call main assignment logic
⑤ Return success/error response

**Next hop**: `lib/assignment/run.ts:run()` → main assignment logic
**WATCH OUT**: No authentication check in this endpoint
**TIP**: Add rate limiting to prevent abuse

---

**File**: `lib/assignment/run.ts` → **Function**: `runAssignment`

**Purpose**: Main entry point for assignment logic
**Why**: Central coordinator that routes to immediate or pool assignment
**When**: Called by API endpoint
**Inputs**: `bookingId: number`
**Outputs**: `RunResult` object with status and details
**Data touched**: `autoAssignmentConfig`, `bookingPlan`, pool storage

```ts
export async function runAssignment(bookingId: number): Promise<RunResult> {
  console.log(`🚀 Starting assignment for booking ${bookingId}`);
  
  try {
    const policy = await loadPolicy();           // ① load configuration
    
    if (!policy.autoAssignEnabled) {             // ② master kill switch
      console.log("❌ Auto-assignment is disabled");
      return {
        status: "escalated",
        reason: "auto-assign disabled"
      };
    }

    const booking = await prisma.bookingPlan.findUnique({  // ③ fetch booking
      where: { bookingId },
      select: {
        bookingId: true,
        timeStart: true,
        timeEnd: true,
        meetingType: true,
        interpreterEmpCode: true,
        meetingDetail: true
      }
    });

    if (!booking) {                              // ④ booking exists?
      console.log(`❌ Booking ${bookingId} not found`);
      return {
        status: "escalated",
        reason: "booking not found"
      };
    }

    if (booking.interpreterEmpCode) {            // ⑤ already assigned?
      console.log(`✅ Booking ${bookingId} already has interpreter ${booking.interpreterEmpCode}`);
      return {
        status: "assigned",
        interpreterId: booking.interpreterEmpCode,
        reason: "already assigned"
      };
    }

    const isUrgent = await shouldAssignImmediately(booking.timeStart, booking.meetingType);  // ⑥ urgency gate
    
    if (!isUrgent) {                             // ⑦ not urgent → pool
      console.log(`📥 Booking ${bookingId} is not urgent, adding to pool`);
      
      const poolEntry = await bookingPool.addToPool(
        booking.bookingId,
        booking.meetingType,
        booking.timeStart,
        booking.timeEnd
      );
      
      return {
        status: "pooled",
        reason: `Non-urgent booking added to pool (decision window: ${poolEntry.decisionWindowTime.toISOString()})`,
        poolEntry
      };
    }

    console.log(`⚡ Booking ${bookingId} is urgent, proceeding with immediate assignment`);
    
    return await performAssignment(booking, policy);  // ⑧ immediate assignment
    
  } catch (error) {
    console.error(`❌ Error in assignment for booking ${bookingId}:`, error);
    return {
      status: "escalated",
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
```

**Step-by-step**:
① Load and validate policy configuration
② Check if auto-assignment is globally enabled
③ Fetch booking details from database
④ Guard: return error if booking not found
⑤ Guard: return success if already assigned
⑥ Check if booking needs immediate assignment
⑦ If not urgent, add to pool for later processing
⑧ If urgent, proceed with immediate assignment

**Next hop**: 
- If urgent: `performAssignment()` → scoring and selection
- If not urgent: `bookingPool.addToPool()` → pool storage

**WATCH OUT**: No transaction wrapping - could have race conditions
**TIP**: Add booking ID to all log messages for easier tracing

### Step 2: Policy Loading

**File**: `lib/assignment/policy.ts` → **Function**: `loadPolicy`

**Purpose**: Load and validate assignment configuration
**Why**: Ensures system uses safe, consistent settings
**When**: At start of every assignment
**Inputs**: None (reads from database)
**Outputs**: `AssignmentPolicy` object with clamped values
**Data touched**: `autoAssignmentConfig` table

```ts
export async function loadPolicy(): Promise<AssignmentPolicy> {
  try {
    const config = await prisma.autoAssignmentConfig.findFirst({  // ① get latest config
      orderBy: { updatedAt: 'desc' }
    });

    if (!config) {                               // ② no config exists
      const defaultConfig = await prisma.autoAssignmentConfig.create({
        data: DEFAULT_POLICY
      });
      return validateAndClampPolicy(defaultConfig);
    }

    return validateAndClampPolicy(config);       // ③ validate and clamp
  } catch (error) {
    console.error("Error loading assignment policy:", error);
    return DEFAULT_POLICY;                       // ④ fallback to defaults
  }
}
```

**Step-by-step**:
① Query database for most recent configuration
② If no config exists, create default configuration
③ Validate and clamp all values to safe ranges
④ If database error, use hardcoded defaults

**Next hop**: Back to `runAssignment()` with validated policy
**Data touched**: `autoAssignmentConfig` table (read/write)
**WATCH OUT**: Database errors could cause fallback to defaults
**TIP**: Log when defaults are used vs database config

---

**File**: `lib/assignment/policy.ts` → **Function**: `validateAndClampPolicy`

**Purpose**: Ensure policy values are within safe ranges
**Why**: Prevents system errors from bad configuration
**When**: After loading policy from database
**Inputs**: Raw config object from database
**Outputs**: Validated `AssignmentPolicy` with clamped values

```ts
function validateAndClampPolicy(config: Record<string, unknown>): AssignmentPolicy {
  const mode = (config.mode as string) || 'NORMAL';
  const validMode = (mode === 'BALANCE' || mode === 'URGENT' || mode === 'NORMAL' || mode === 'CUSTOM') ? mode : 'NORMAL';  // ①
  
  const clamped: AssignmentPolicy = {
    autoAssignEnabled: Boolean(config.autoAssignEnabled),
    mode: validMode,
    fairnessWindowDays: Math.max(7, Math.min(90, Number(config.fairnessWindowDays) || 30)),      // ② clamp 7-90
    maxGapHours: Math.max(1, Math.min(100, Number(config.maxGapHours) || 5)),                    // ③ clamp 1-100
    minAdvanceDays: Math.max(0, Math.min(30, Number(config.minAdvanceDays) || 2)),               // ④ clamp 0-30
    w_fair: Math.max(0, Math.min(5, Number(config.w_fair) || 1.2)),                             // ⑤ clamp 0-5
    w_urgency: Math.max(0, Math.min(5, Number(config.w_urgency) || 0.8)),
    w_lrs: Math.max(0, Math.min(5, Number(config.w_lrs) || 0.3)),
    drConsecutivePenalty: Math.max(-2.0, Math.min(0, Number(config.drConsecutivePenalty) || -0.5)),  // ⑥ clamp -2 to 0
  };

  if (validMode !== 'CUSTOM') {                  // ⑦ apply mode defaults
    const defaults = getModeDefaults(validMode);
    return {
      ...clamped,
      ...defaults,
    };
  }

  return clamped;
}
```

**Step-by-step**:
① Validate mode is one of allowed values, default to NORMAL
②-⑥ Clamp all numeric values to safe ranges with fallback defaults
⑦ For non-CUSTOM modes, override with mode-specific defaults

**Next hop**: Returns to `loadPolicy()` caller
**WATCH OUT**: Mode defaults override user settings for non-CUSTOM modes
**TIP**: Log when values are clamped to help debug configuration issues#
## Step 3: Urgency Gate Decision

**File**: `lib/assignment/pool.ts` → **Function**: `shouldAssignImmediately`

**Purpose**: Decide if booking needs immediate assignment or can wait in pool
**Why**: Urgent bookings get priority, others wait for better optimization
**When**: After booking is fetched and validated
**Inputs**: `startTime: Date`, `meetingType: string`
**Outputs**: `boolean` - true for immediate, false for pool
**Data touched**: `meetingTypePriority` table

```ts
export async function shouldAssignImmediately(
  startTime: Date,
  meetingType: string
): Promise<boolean> {
  const priority = await getMeetingTypePriority(meetingType);  // ① get meeting config
  if (!priority) return false;                                 // ② no config = not urgent
  
  const daysUntil = Math.floor((startTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));  // ③ calculate days
  return daysUntil <= priority.urgentThresholdDays;            // ④ compare with threshold
}
```

**Step-by-step**:
① Get priority configuration for this meeting type
② If no configuration found, default to not urgent
③ Calculate days between now and meeting start time
④ Compare with urgentThresholdDays from configuration

**Next hop**: 
- If true: Continue to immediate assignment
- If false: `bookingPool.addToPool()` → pool storage

**Data touched**: `meetingTypePriority` table (read)
**WATCH OUT**: Negative days (past meetings) should be handled
**TIP**: Log the calculated days and threshold for debugging

### Step 4: Pool Storage (Non-Urgent Path)

**File**: `lib/assignment/pool.ts` → **Function**: `addToPool`

**Purpose**: Store non-urgent booking for later processing
**Why**: Allows batch optimization and better resource planning
**When**: When `shouldAssignImmediately()` returns false
**Inputs**: `bookingId`, `meetingType`, `startTime`, `endTime`
**Outputs**: `BookingPoolEntry` with decision window time
**Data touched**: In-memory pool storage (Map)

```ts
async addToPool(
  bookingId: number,
  meetingType: string,
  startTime: Date,
  endTime: Date
): Promise<BookingPoolEntry> {
  const priority = await getMeetingTypePriority(meetingType);   // ① get meeting config
  if (!priority) {
    throw new Error(`No priority configuration found for meeting type: ${meetingType}`);
  }

  const poolEntry: BookingPoolEntry = {
    bookingId,
    meetingType,
    startTime,
    endTime,
    priorityValue: priority.priorityValue,                      // ② copy priority data
    urgentThresholdDays: priority.urgentThresholdDays,
    generalThresholdDays: priority.generalThresholdDays,
    poolEntryTime: new Date(),                                  // ③ timestamp entry
    decisionWindowTime: new Date(Date.now() + priority.generalThresholdDays * 24 * 60 * 60 * 1000)  // ④ calculate wake-up time
  };

  this.pool.set(bookingId, poolEntry);                          // ⑤ store in memory
  console.log(`📥 Added booking ${bookingId} to pool (${meetingType}, decision window: ${poolEntry.decisionWindowTime.toISOString()})`);
  
  return poolEntry;
}
```

**Step-by-step**:
① Get meeting type configuration for priority and thresholds
② Copy priority data to pool entry for later sorting
③ Record when booking was added to pool
④ Calculate when booking should be processed (now + generalThresholdDays)
⑤ Store in memory pool with bookingId as key

**Next hop**: Returns to `runAssignment()` with pool entry details
**Data touched**: In-memory Map, `meetingTypePriority` table (read)
**WATCH OUT**: In-memory storage lost on restart - consider Redis for production
**TIP**: Add pool size monitoring and cleanup of old entries

### Step 5: Pool Processing (Wake-up Cycle)

**File**: `lib/assignment/run.ts` → **Function**: `processPool`

**Purpose**: Process pool entries that have reached their decision window
**Why**: Ensures pooled bookings eventually get assigned
**When**: Called periodically or manually triggered
**Inputs**: None (reads from pool)
**Outputs**: Array of `RunResult` for each processed entry
**Data touched**: Pool storage, same as immediate assignment

```ts
export async function processPool(): Promise<RunResult[]> {
  console.log("🔄 Processing booking pool...");
  
  const readyEntries = await processPoolEntries();              // ① get ready entries
  const results: RunResult[] = [];
  
  if (readyEntries.length === 0) {
    console.log("📭 No pool entries ready for assignment");
    return [];
  }
  
  const policy = await loadPolicy