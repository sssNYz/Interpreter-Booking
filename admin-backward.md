# Admin Backfill Booking (Backward Booking)

Simple, admin-only flow to record past bookings to reflect interpreter workload. No emails, no conflicts, no recurrence. Required note is stored in forwardActions JSON. This doc is the implementation guide for the next coding session.

## Goals
- Admin can create a one-off booking at any past date/time.
- Admin must select an interpreter explicitly (within their environment scope if applicable).
- Hard-block time conflicts; no override.
- Do not send or collect any emails.
- Store a required backfill note in `BOOKING_PLAN.FORWARD_ACTIONS`.
- Create booking as approved, so it counts toward workload immediately.

## Scope & Constraints
- Admin-only (roles: `ADMIN` or `SUPER_ADMIN`).
- No recurrence: create just one booking per action.
- No email verification; skip reminders/notifications entirely.
- Keep schema unchanged; use existing fields + `forwardActions` JSON.

## Data Model (Prisma)
- No new columns or migrations.
- Persist a backfill action entry in `BookingPlan.forwardActions` JSON array.
  - Shape example:
    ```json
    {
      "action": "BACKFILL",
      "actor": "admin",
      "empCode": "{adminEmpCode}",
      "at": "{ISO-8601}",
      "note": "{required reason from admin}"
    }
    ```
- Continue using existing columns for time, room, interpreter, etc. See `prisma/schema.prisma`.

## API Design
- Route: `POST /api/admin/bookings/backfill`
- AuthZ: server verifies user session, roles include `ADMIN` or `SUPER_ADMIN`.
- Input: mirror `CreateBookingRequest` with a required `note` string; enforce admin rules server-side:
  - Required: `ownerEmpCode`, `ownerGroup`, `meetingRoom`, `meetingType`, `timeStart`, `timeEnd`, `interpreterEmpCode`, `note`.
  - Meeting-type specifics:
    - `DR` requires `drType` and `chairmanEmail` (existing rules preserved).
    - `Other` requires `otherType` and `otherTypeScope=meeting_type` (existing rules preserved).
    - Non-DR/Other: must not include `drType`/`otherType`.
  - Ignored/forced: `isRecurring=false`; ignore any recurrence fields if provided.
  - Ignored/forbidden: `inviteEmails`, any mail-related params.
  - Past time allowed: bypass user forward-month limits.
- Conflict checks (server):
  - Interpreter time overlap: HARD BLOCK (409) using existing overlap checks.
  - Same-room overlap: keep existing hard block behavior.
  - Chairman conflict (for DR): keep existing behavior.
- Behavior on success:
  - Insert booking with `bookingStatus='approve'`.
  - Set `interpreterEmpCode` to the selected interpreter (no auto-assign).
  - Append a `BACKFILL` action with the required note into `forwardActions`.
  - Return `{ success: true, data: { bookingId, timeStart, timeEnd, interpreterEmpCode } }`.

### Request Shape (TypeScript)
```ts
// Base from types/booking-requests.ts with constraints below
interface AdminBackfillRequest {
  ownerEmpCode: string;
  ownerGroup: import("@/types/booking").OwnerGroup;
  meetingRoom: string;
  meetingType: import("@/prisma/prisma").MeetingType;
  timeStart: string; // "YYYY-MM-DD HH:mm:ss" local
  timeEnd: string;   // "YYYY-MM-DD HH:mm:ss" local
  interpreterEmpCode: string; // required
  meetingDetail?: string;
  applicableModel?: string | null;
  // DR
  drType?: import("@/prisma/prisma").DRType | null;
  chairmanEmail?: string | null;
  // Other
  otherType?: string | null;
  otherTypeScope?: import("@/prisma/prisma").OtherTypeScope | null;
  // Optional metadata
  languageCode?: string | null;
  meetingLink?: string | null;
  // Required for backfill
  note: string; // required, short reason
}
```

### Response Shape
```json
{
  "success": true,
  "data": {
    "bookingId": 123,
    "timeStart": "2025-10-01 09:00:00",
    "timeEnd": "2025-10-01 10:00:00",
    "interpreterEmpCode": "I00001"
  }
}
```

### Error Cases
- 401 Unauthenticated or 403 Not admin
- 400 Validation failed (field errors)
- 409 Room conflict (`code: "ROOM_CONFLICT"`)
- 409 Interpreter conflict (`code: "INTERPRETER_CONFLICT"`)
- 409 DR chairman conflict (`code: "CHAIRMAN_CONFLICT"`)

## Server Implementation Checklist
1) Create route `app/api/admin/bookings/backfill/route.ts`:
- Parse JSON body; validate using adapted rules from `app/api/booking-data/post-booking-data/route.ts`:
  - Reuse `validateBookingData` logic but:
    - Require `interpreterEmpCode` always.
    - Reject recurrence and inviteEmails; do not accept `force` to bypass constraints.
    - Allow past dates by skipping `FORWARD_MONTH_LIMIT` checks.
- Resolve session user via `cookies` + `verifySessionCookieValue` and load roles (see `app/api/auth/me/route.ts`).
- Authorize: roles include `ADMIN` or `SUPER_ADMIN`.
- Normalize data (`chairmanEmail` lowercasing, trimmed meeting link), same as user route.
- Start transaction and obtain global lock (same pattern as user route) to serialize checks.
- Capacity + conflict checks (copied/adapted from user route):
  - Global capacity check (optional to keep parity with user flow).
  - Same-room overlap: hard block (return 409 with details).
  - DR chairman conflict: hard block if applicable.
  - Interpreter overlap: hard block using SQL or helper in `lib/assignment/utils/conflict-detection.ts`.
- Insert booking row with:
  - `bookingStatus='approve'`.
  - `interpreterEmpCode` = selected interpreter.
  - `isRecurring=0` and clear all recurrence fields.
  - `forwardActions` = append `BACKFILL` object with `{ actor:'admin', empCode, at, note }`.
- Do not enqueue auto-assignment or send emails.

2) Authorization helper (reuse pattern):
- Use the role pattern seen in:
  - `app/api/admin-dashboard/*/route.ts`
  - `app/api/environments/[id]/**/route.ts`
- Optional: If environment scoping is required, ensure the selected interpreter belongs to one of the admin’s environments (`ENVIRONMENT_INTERPRETER`). Reject otherwise (400/403).

## UI Implementation Checklist
- New page: `app/AdminPage/backfill-booking/page.tsx`.
  - Simple form with:
    - Date picker and time pickers allowing past dates.
    - Owner fields (same as user booking; admin must fill everything like user form).
    - Meeting room, meeting type (+ DR/Other specifics), language (optional).
    - Interpreter dropdown (required), filtered by availability.
    - Required text area: Backfill note (reason).
    - Submit to `POST /api/admin/bookings/backfill`.
  - After success: toast + optional redirect back to admin overview or calendar refresh.
- Interpreter list: call `GET /api/employees/interpreters?language=...&timeStart=...&timeEnd=...` to fetch only available interpreters for the selected window.
- Reuse building blocks from `components/BookingForm/booking-form.tsx` where convenient, but:
  - Hide recurrence controls.
  - Hide invite emails section.
  - Allow past date/time selection (do not use the calendar click restrictions in `components/BookingCalendar/day-row.tsx`).

## Testing Plan
- Unit-level validation checks for the new route:
  - Past time accepted for admins.
  - `interpreterEmpCode` required.
  - Recurrence and invite emails are rejected.
  - Meeting-type specific rules enforced.
- Integration script `scripts/test-backfill-booking.js`:
  - Create an admin session (or mock cookie), choose an interpreter and past timeslot with no conflicts, POST to the new route, assert 201 and approved status.
  - Try conflicting window and assert 409 (`INTERPRETER_CONFLICT`).
  - Try DR without chairman -> 400.
- Seed data: ensure at least one admin, one interpreter, and a few rooms exist (see `prisma/seed.ts`).

## Rollout
- Optional feature flag: `ENABLE_ADMIN_BACKFILL=true` (server-side).
  - Add to `lib/feature-flags.ts` as `enableAdminBackfill` if desired; gate the new API and UI entry point.
- Deploy API; page link visible only to admins.
- No database migration needed.

## File Map & References
- Schema: `prisma/schema.prisma`
- User booking API (reference for validations and checks): `app/api/booking-data/post-booking-data/route.ts`
- Interpreter availability helpers: `lib/assignment/utils/conflict-detection.ts`
- Interpreters list API: `app/api/employees/interpreters/route.ts`
- Session/roles example: `app/api/auth/me/route.ts`
- Admin pages to anchor link from: `app/AdminPage/page.tsx`, `app/AdminPage/booking-manage-page/page.tsx`

## Acceptance Criteria
- Admin can create a single, past-time booking with a required note.
- Booking is saved with `approve` status and assigned interpreter (no auto-assign).
- No emails are sent or collected.
- Conflict checks prevent double booking; server returns 409 with details when busy.
- Backfill action logged in `forwardActions` with admin empCode and note.

---

Prepared for next implementation session. This guide keeps the change surface minimal (API + page) and avoids schema changes while ensuring accuracy and auditability.

