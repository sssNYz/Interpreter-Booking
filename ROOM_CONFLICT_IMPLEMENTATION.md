# Room Conflict Detection Implementation

## Overview

This implementation adds room conflict detection to prevent double bookings of the same room at the same time. Users can no longer book the same room for overlapping time periods.

## Changes Made

### 1. API Changes (`app/api/booking-data/post-booking-data/route.ts`)

- Updated room conflict detection logic
- Changed error code from `OVERLAP_WARNING` to `ROOM_CONFLICT` for room conflicts
- Updated error message to be more specific about room conflicts
- Room conflicts now prevent booking creation (no force override)

### 2. Frontend Changes (`components/BookingForm/booking-form.tsx`)

- Added handling for `ROOM_CONFLICT` error code
- Shows specific error message when room conflict occurs
- Prevents force submission for room conflicts
- User must choose different room or time

### 3. Room Selection (`components/BookingForm/sections/MeetingDetailsSection.tsx`)

- Already implemented with combobox for room selection
- Fetches active rooms from API
- Shows room name and floor location
- Includes search functionality

## How It Works

1. **Room Selection**: User selects a room from the dropdown (fetched from active rooms)
2. **Time Selection**: User selects start and end times
3. **Conflict Check**: When booking is submitted, API checks for existing bookings in the same room during the same time
4. **Error Handling**: If conflict found, shows error message and prevents booking
5. **Success**: If no conflict, booking is created successfully

## Error Messages

- **Room Conflict**: "Room '[Room Name]' is already booked during this time. Please choose a different room or time."
- **Capacity Full**: "The selected time slot has reached its capacity" (for interpreter capacity)

## Testing

Run the test script to verify room conflict detection:

```bash
node test-room-conflict.js
```

## Database Schema

The system uses the existing `BOOKING_PLAN` table with:

- `MEETING_ROOM`: Room name/identifier
- `TIME_START`: Booking start time (UTC)
- `TIME_END`: Booking end time (UTC)
- `BOOKING_STATUS`: Status (excludes 'cancel' from conflict checks)

## Future Enhancements

1. **Real-time Room Availability**: Show room availability in real-time
2. **Room Capacity**: Check room capacity limits
3. **Room Equipment**: Validate room equipment requirements
4. **Recurring Bookings**: Handle room conflicts for recurring bookings
5. **Room Preferences**: Allow users to set room preferences
