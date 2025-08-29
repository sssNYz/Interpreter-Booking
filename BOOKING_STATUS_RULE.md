# Booking Status Business Rule

## Overview

This document describes the business rule that ensures the `bookingStatus` field is automatically updated to `"approve"` whenever an `interpreterEmpCode` is assigned to a booking.

## Business Rule

**When `interpreterEmpCode` is not NULL (meaning a booking plan has been approved with an interpreter), the `bookingStatus` must automatically change to `"approve"`.**

## Implementation

### 1. Auto-Assignment Logic

The business rule is implemented in the auto-assignment system (`lib/assignment/run.ts`):

```typescript
// Assign interpreter and update status to approve
// Business Rule: When interpreterEmpCode is assigned, bookingStatus must be "approve"
await tx.bookingPlan.update({
  where: { bookingId },
  data: { 
    interpreterEmpCode: winner.empCode,
    bookingStatus: "approve"
  }
});
```

### 2. Utility Function

A utility function is available in `lib/utils.ts` to ensure this rule is followed in any custom assignment logic:

```typescript
import { ensureBookingStatusOnAssignment } from '@/lib/utils';

// Use this function when updating booking data
const updateData = ensureBookingStatusOnAssignment({
  interpreterEmpCode: "EMP001",
  // bookingStatus will automatically be set to "approve"
});
```

## Database Schema

The `BookingPlan` model in `prisma/schema.prisma` includes both fields:

```prisma
model BookingPlan {
  // ... other fields ...
  interpreterEmpCode       String?           @map("INTERPRETER_EMP_CODE") @db.VarChar(64)
  bookingStatus            BookingStatus     @default(waiting) @map("BOOKING_STATUS")
  // ... other fields ...
}

enum BookingStatus {
  approve
  cancel
  waiting
  complet
}
```

## Testing

A test script is available at `scripts/test-booking-status.js` to verify this business rule:

```bash
node scripts/test-booking-status.js
```

This script:
1. Creates a test booking with `bookingStatus: "waiting"`
2. Triggers auto-assignment to assign an interpreter
3. Verifies that `bookingStatus` is automatically updated to `"approve"`
4. Cleans up test data

## Usage Examples

### Auto-Assignment (Automatic)

When the auto-assignment system runs, it automatically ensures both fields are updated:

```typescript
// This happens automatically in the auto-assignment system
await prisma.bookingPlan.update({
  where: { bookingId },
  data: { 
    interpreterEmpCode: "EMP001",
    bookingStatus: "approve"  // Automatically set
  }
});
```

### Manual Assignment (Using Utility)

For any custom assignment logic, use the utility function:

```typescript
import { ensureBookingStatusOnAssignment } from '@/lib/utils';

const assignmentData = ensureBookingStatusOnAssignment({
  interpreterEmpCode: "EMP001"
});

await prisma.bookingPlan.update({
  where: { bookingId },
  data: assignmentData
});
```

## Enforcement

This business rule is enforced at the application level in two ways:

1. **Explicit in Auto-Assignment**: The auto-assignment system explicitly sets both fields
2. **Utility Function**: A utility function ensures the rule is followed in custom code

## Future Considerations

If additional assignment methods are added to the system, they should:

1. Use the `ensureBookingStatusOnAssignment` utility function, OR
2. Explicitly set `bookingStatus: "approve"` when setting `interpreterEmpCode`

This ensures consistency across all assignment methods.
