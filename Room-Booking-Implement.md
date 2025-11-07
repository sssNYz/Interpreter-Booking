# Room Booking — Implementation Plan (Shared BOOKING_PLAN)

This document describes how to implement Room Booking using the existing `BOOKING_PLAN` table (shared with interpreter bookings) by introducing a lightweight flag to distinguish booking kinds, plus a small, focused API and guardrails. It’s designed to be incremental, safe, and reversible.

## Goals
- Use the same DB table (`BOOKING_PLAN`) for both Interpreter and Room bookings.
- Introduce a clear, indexed discriminator to separate flows.
- Provide a dedicated API for room bookings with strong validation and room‑specific conflict checks.
- Ensure the interpreter auto‑assignment engine never touches room bookings.
- Minimize blast radius across the codebase.

## Summary of Changes
- Schema (Prisma + MySQL): add `BookingKind` enum and `bookingKind` column to `BookingPlan`.
- API: add `app/api/booking-room/post-booking-room/route.ts` for creating room bookings.
- Types: add a request type for room bookings (or reuse and validate per route).
- Validation: enforce room fields, forbid interpreter-only fields, block room conflicts.
- Guardrails: teach scheduler/assignment to skip `ROOM` kind.
- UI wiring: point the room flow to the new API route and optionally tag/filter by kind in history/admin views.
- Tests & docs: basic scripts to verify room conflict and non-interference with interpreter assignment.

## 1) Database & Prisma Schema

Add a discriminator on `BOOKING_PLAN` to indicate kind:

### Prisma Schema Changes (prisma/schema.prisma)
- Add a new enum:
  - `enum BookingKind { INTERPRETER ROOM }`
- Add a new field to `model BookingPlan`:
  - `bookingKind BookingKind @default(INTERPRETER) @map("BOOKING_KIND")`
  - Add index: `@@index([bookingKind])`

Notes:
- Mapping (`@map`) keeps DB column uppercase and consistent with the rest.
- Default `INTERPRETER` ensures all existing data remains valid with no backfill race.

### Migration SQL (MySQL)
If performing a manual migration, the essence is:

```sql
-- Add enum-equivalent in Prisma; in MySQL this is a VARCHAR constrained at app level
ALTER TABLE `BOOKING_PLAN`
  ADD COLUMN `BOOKING_KIND` VARCHAR(16) NOT NULL DEFAULT 'INTERPRETER';

-- Optional backfill explicit (safe if table already has data)
UPDATE `BOOKING_PLAN` SET `BOOKING_KIND` = 'INTERPRETER' WHERE `BOOKING_KIND` IS NULL;

-- Index for efficient filters and joins
CREATE INDEX `BOOKING_PLAN_BOOKING_KIND_idx` ON `BOOKING_PLAN` (`BOOKING_KIND`);
```

Then update `prisma/schema.prisma` and run `npx prisma generate`.

## 2) API — Room Booking Endpoint

Create a dedicated endpoint for room bookings:
- Path: `app/api/booking-room/post-booking-room/route.ts`
- Method: `POST`
- Purpose: Create a `ROOM` booking with room conflict prevention, no interpreter assignment.

### Request Shape (recommended)
Use a room-focused request type; fields with asterisks are required.

```
{
  ownerEmpCode*,
  ownerGroup*,
  meetingRoom*,
  timeStart* : "YYYY-MM-DD HH:mm:ss",
  timeEnd*   : "YYYY-MM-DD HH:mm:ss",
  meetingType?,
  meetingDetail?,
  applicableModel?,
  inviteEmails?,
  // explicitly forbidden in this route: interpreterEmpCode, languageCode, chairmanEmail,
  // selectedInterpreterEmpCode, drType, otherTypeScope (unless you intentionally allow)
}
```

### Validation Rules
- Required: `ownerEmpCode`, `ownerGroup`, `meetingRoom`, `timeStart`, `timeEnd`.
- Time format: strict `YYYY-MM-DD HH:mm:ss`; `timeStart < timeEnd`.
- Forbid interpreter-only/DR-only fields for this route (reject with 400):
  - `interpreterEmpCode`, `languageCode`, `chairmanEmail`, `selectedInterpreterEmpCode`, `drType`, `otherType`, `otherTypeScope`.
- Optional: allow `meetingType` but avoid DR/President specific constraints in this route.

### Room Conflict Check
Block creation if any non-cancel booking overlaps the same room:

```
WHERE MEETING_ROOM = :meetingRoom
  AND BOOKING_STATUS <> 'cancel'
  AND (TIME_START < :timeEnd AND TIME_END > :timeStart)
```

This intentionally checks across all kinds (both `INTERPRETER` and `ROOM`) to prevent double-booking the physical room.

### Persistence Behavior
- Insert into `BOOKING_PLAN` with:
  - `BOOKING_KIND='ROOM'`
  - `INTERPRETER_EMP_CODE=NULL` (never set by this route)
  - No `AUTO_ASSIGN_*` scheduling or calls into assignment
  - If recurrence is later allowed, reuse the existing occurrence generation, but still enforce room conflicts per child occurrence.

### Response
Follow existing `ApiResponse` shape used by `booking-data` endpoints:
- On success: `{ success: true, data: { bookingId, ... } }`
- On conflict: `{ success: false, code: 'ROOM_CONFLICT', message, data: { conflicts[] } }` with HTTP 409.

## 3) Types

Options:
1) Add a dedicated type `CreateRoomBookingRequest` (preferred for separation).
2) Reuse `CreateBookingRequest` from `types/booking-requests.ts` in this endpoint but validate that interpreter-only fields are absent.

Additionally, export `BookingKind` from Prisma and optionally add it to list/read models so admin/history views can filter by kind.

## 4) Assignment & Scheduler Guardrails (Recommended)

To prevent accidental assignment attempts on room bookings:
- `lib/assignment/scheduler/compute.ts` and `db-polling-scheduler.ts`:
  - When computing/scheduling or scanning for due bookings, early-skip rows with `bookingKind='ROOM'`.
  - E.g., add `where: { bookingKind: 'INTERPRETER' }` to queries for due bookings, and avoid updating `AUTO_ASSIGN_*` for room bookings.
- `lib/assignment/core/run.ts`:
  - Early return if the loaded booking has `bookingKind='ROOM'` with `{ status: 'escalated', reason: 'room booking — skip auto-assign' }`.

These guardrails are defensive — the room booking route won’t schedule anything, but the scheduler and assignment code should still be robust.

## 5) UI/UX Wiring (Optional, Minimal)

The UI already supports selecting rooms and surfaces `ROOM_CONFLICT`.
- For a dedicated “Room booking” flow, point submit to `/api/booking-room/post-booking-room`.
- History/Admin views:
  - Optionally add a column/badge for `bookingKind` to distinguish rows.
  - Provide filters (All/Interpreter/Room) if useful.
  - For room rows, hide interpreter-only columns (selected interpreter, language, chairman).

No UI change is strictly required if you just call the new endpoint from an existing form with matching fields.

## 6) Testing Strategy

Add a minimal integration script under `scripts/`, e.g. `scripts/test-room-booking.js`:
- Create a first room booking (A) for room R, 10:00–11:00.
- Attempt a second booking (B) for the same room R, 10:30–11:00 → expect 409 `ROOM_CONFLICT`.
- Verify (via Prisma) that A has `bookingKind='ROOM'`, interpreter fields are null, and `AUTO_ASSIGN_STATUS` is null/unchanged.
- Create a non-overlapping booking for R, 11:00–12:00 → success.

Optionally extend to recurrence if you enable it for room bookings.

## 7) Rollout & Order of Operations

1) Schema/Migration
   - Add `BookingKind` enum and `bookingKind` field with default `INTERPRETER`.
   - Run migration; run `npx prisma generate`.
2) API Route
   - Implement `POST /api/booking-room/post-booking-room` with validation + room conflict checks; persist with `BOOKING_KIND='ROOM'`.
3) Guardrails
   - Update scheduler and assignment code to skip `ROOM` kind (queries/early returns).
4) UI Routing (optional)
   - Wire form submit to the new route for room bookings; keep existing components.
5) Tests & Docs
   - Add the script; run it locally; update README/notes if desired.

## 8) Decision Points (You Can Defer)

- Recurrence for Rooms: enable now or later; if enabled, enforce conflicts for each child.
- MeetingType Policy for Rooms: allow any meetingType vs restrict to a subset.
- Overrides: do not allow “force” to bypass room conflicts (current recommendation); revisit if a supervisor override is needed.
- Notifications: whether to send emails for room bookings (and which templates to reuse).
- Admin Views: whether to separate or combine Interpreter/Room lists by default.

## 9) Impacted Areas Checklist

Required:
- prisma/schema.prisma (enum + field + index)
- New route file: `app/api/booking-room/post-booking-room/route.ts`
- types (either new `CreateRoomBookingRequest` or reuse + route-level validation)
- Validation + room conflict query

Recommended guardrails:
- lib/assignment/scheduler/compute.ts (skip ROOM)
- lib/assignment/scheduler/db-polling-scheduler.ts (skip ROOM)
- lib/assignment/core/run.ts (early return for ROOM)

Optional UI/UX:
- Booking form submit target, history/admin filters/badges

Optional scripts/docs:
- Integration script under `scripts/`
- Short note in README or a link to this doc

## 10) Non-Goals / Compatibility

- No changes to existing interpreter booking flows.
- No changes to `ROOM` table structure required (we continue using `MEETING_ROOM` on `BOOKING_PLAN`).
- No pool system or assignment scheduling for room bookings.

## 11) Error Codes

- `ROOM_CONFLICT`: Room already booked during this time. HTTP 409.
- `VALIDATION_ERROR`: Missing/invalid required fields. HTTP 400.

## 12) Addendum — Auto‑Approve Rooms & Interpreter‑Only Views (2025‑11‑06)

This addendum aligns the product behavior with the requirement that room bookings:
- are approved immediately (no admin approval), and
- never participate in interpreter flows or UIs.

### Rationale
- UX: Room reservation should be a lightweight action — no approval queue.
- Safety: The room route already blocks conflicts and is excluded from the assignment engine; approval is low‑risk.
- Clarity: Interpreter calendars and admin manage views should only show interpreter bookings to avoid confusion.

### Implementation Steps

1) Auto‑approve in the Room POST endpoint
   - File: `app/api/booking-room/post-booking-room/route.ts`
   - Change persistence to force `BOOKING_STATUS='approve'` for all successful room bookings (ignore client‑supplied `bookingStatus`).
   - Keep: `BOOKING_KIND='ROOM'`; never set any interpreter fields; persist optional `meetingLink`, DR/Other metadata as today.

2) Hide ROOM bookings from the interpreter calendar
   - File: `app/api/booking-data/get-booking-byDate/[year]/[month]/route.ts`
   - Add filter `where: { bookingKind: 'INTERPRETER' }` so the endpoint only returns interpreter bookings.
   - Reason: `components/BookingCalendar/booking-calendar.tsx` consumes this API; excluding ROOM rows keeps the UI focused on interpreter usage while room availability still comes from `/api/rooms/booked`.

3) Hide ROOM bookings from Admin Booking Management
   - File: `app/api/booking-data/get-booking/route.ts`
   - Add filter `where: { bookingKind: 'INTERPRETER' }` when listing bookings for manage view.
   - Reason: This view is for interpreter workflows (forwarding, approvals, ETA); room bookings don’t belong there.

4) Preserve room occupancy and conflict prevention
   - Keep `app/api/rooms/booked/route.ts` as is (it aggregates bookings by physical room across all kinds and statuses except `cancel`).
   - Reason: Prevent double‑booking whether the other booking was created via the interpreter or room flow.

5) Indexing (recommended)
   - Ensure an index exists on `BOOKING_PLAN(BOOKING_KIND)` to support new filters at scale.
   - In Prisma: add `@@index([bookingKind])` to `model BookingPlan` if not present; run migration.

6) Optional enhancements (future)
   - Add a query param to calendar/admin endpoints, e.g. `?kinds=INTERPRETER|ROOM|ALL`, default `INTERPRETER`, if mixed views are ever needed.
   - Add badges/filters in history/admin views to toggle between booking kinds.

### Testing Checklist
- Room POST creates a row with `BOOKING_KIND='ROOM'` and `BOOKING_STATUS='approve'`.
- `/api/rooms/booked?date=YYYY-MM-DD` shows the room as busy for the selected day.
- Interpreter calendar data endpoint excludes ROOM rows; no room bookings rendered in `booking-calendar`.
- Admin Booking Management endpoint excludes ROOM rows; no room bookings rendered in manage UI.
- Assignment/ETA logs show no activity for room bookings (guardrails already in place).

### Rollout
- Implement in the order above; deploy as a single change. No config flags required.
- If needed, roll back by reverting the endpoint filters and switching status in the room route from `approve` back to `waiting`.

## 12) Examples

### Successful Create (minimal)
```
POST /api/booking-room/post-booking-room
{
  "ownerEmpCode": "E12345",
  "ownerGroup": "software",
  "meetingRoom": "R-101",
  "timeStart": "2025-01-05 10:00:00",
  "timeEnd":   "2025-01-05 11:00:00"
}
```

Response
```
200 OK
{
  "success": true,
  "data": {
    "bookingId": 1234,
    "bookingKind": "ROOM"
  }
}
```

### Room Conflict
```
409 CONFLICT
{
  "success": false,
  "code": "ROOM_CONFLICT",
  "message": "Room 'R-101' is already booked during this time.",
  "data": {
    "meetingRoom": "R-101",
    "overlapCount": 1,
    "conflicts": [
      { "bookingId": 1234, "timeStart": "2025-01-05 10:00:00", "timeEnd": "2025-01-05 11:00:00", "bookingStatus": "waiting" }
    ]
  }
}
```

---

This plan keeps the implementation minimal and safe: one new column and one new endpoint, with small guardrails. You can expand later (recurrence, notifications, UI filters) without breaking the core design.
