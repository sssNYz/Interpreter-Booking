import prisma from "@/prisma/prisma";

/**
 * Represents a time conflict between bookings
 */
export interface TimeConflict {
  interpreterId: string;
  conflictingBookingId: number;
  conflictStart: Date;
  conflictEnd: Date;
  conflictType: 'OVERLAP' | 'ADJACENT' | 'CONTAINED';
  conflictingMeetingType: string;
}

/**
 * Represents the availability check result for an interpreter
 */
export interface AvailabilityCheck {
  interpreterId: string;
  requestedStart: Date;
  requestedEnd: Date;
  isAvailable: boolean;
  conflicts: TimeConflict[];
}

/**
 * Check if an interpreter is available during the specified time period
 * @param interpreterId - The interpreter's employee code
 * @param startTime - Start time of the requested booking
 * @param endTime - End time of the requested booking
 * @returns Promise<boolean> - true if available, false if conflicts exist
 */
export async function checkInterpreterAvailability(
  interpreterId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const conflicts = await getConflictingBookings(interpreterId, startTime, endTime);
  return conflicts.length === 0;
}

/**
 * Get detailed information about conflicting bookings for an interpreter
 * @param interpreterId - The interpreter's employee code
 * @param startTime - Start time of the requested booking
 * @param endTime - End time of the requested booking
 * @returns Promise<TimeConflict[]> - Array of conflicts found
 */
export async function getConflictingBookings(
  interpreterId: string,
  startTime: Date,
  endTime: Date
): Promise<TimeConflict[]> {
  // Query for existing bookings that overlap with the requested time
  // We check for bookings that are approved or pending (waiting) as they reserve interpreter time
  const conflictingBookings = await prisma.bookingPlan.findMany({
    where: {
      interpreterEmpCode: interpreterId,
      bookingStatus: {
        in: ['approve', 'waiting'] // Both approved and pending bookings reserve time
      },
      // Time overlap condition: booking overlaps if it starts before our end time and ends after our start time
      AND: [
        {
          timeStart: {
            lt: endTime // Existing booking starts before our booking ends
          }
        },
        {
          timeEnd: {
            gt: startTime // Existing booking ends after our booking starts
          }
        }
      ]
    },
    select: {
      bookingId: true,
      timeStart: true,
      timeEnd: true,
      meetingType: true
    }
  });

  // Convert database results to TimeConflict objects
  return conflictingBookings.map(booking => {
    const conflictType = determineConflictType(
      startTime,
      endTime,
      booking.timeStart,
      booking.timeEnd
    );

    return {
      interpreterId,
      conflictingBookingId: booking.bookingId,
      conflictStart: booking.timeStart,
      conflictEnd: booking.timeEnd,
      conflictType,
      conflictingMeetingType: booking.meetingType
    };
  });
}

/**
 * Filter a list of interpreters to only include those available for the specified time
 * @param interpreterIds - Array of interpreter employee codes to check
 * @param startTime - Start time of the requested booking
 * @param endTime - End time of the requested booking
 * @returns Promise<string[]> - Array of available interpreter IDs
 */
export async function filterAvailableInterpreters(
  interpreterIds: string[],
  startTime: Date,
  endTime: Date
): Promise<string[]> {
  const availableInterpreters: string[] = [];

  // Check availability for each interpreter
  for (const interpreterId of interpreterIds) {
    const isAvailable = await checkInterpreterAvailability(interpreterId, startTime, endTime);
    if (isAvailable) {
      availableInterpreters.push(interpreterId);
    }
  }

  return availableInterpreters;
}

/**
 * Get detailed availability information for multiple interpreters
 * @param interpreterIds - Array of interpreter employee codes to check
 * @param startTime - Start time of the requested booking
 * @param endTime - End time of the requested booking
 * @returns Promise<AvailabilityCheck[]> - Detailed availability information for each interpreter
 */
export async function getInterpreterAvailabilityDetails(
  interpreterIds: string[],
  startTime: Date,
  endTime: Date
): Promise<AvailabilityCheck[]> {
  const availabilityChecks: AvailabilityCheck[] = [];

  for (const interpreterId of interpreterIds) {
    const conflicts = await getConflictingBookings(interpreterId, startTime, endTime);
    
    availabilityChecks.push({
      interpreterId,
      requestedStart: startTime,
      requestedEnd: endTime,
      isAvailable: conflicts.length === 0,
      conflicts
    });
  }

  return availabilityChecks;
}

/**
 * Determine the type of time conflict between two time periods
 * @param requestStart - Start time of the requested booking
 * @param requestEnd - End time of the requested booking
 * @param existingStart - Start time of the existing booking
 * @param existingEnd - End time of the existing booking
 * @returns ConflictType - The type of overlap detected
 */
function determineConflictType(
  requestStart: Date,
  requestEnd: Date,
  existingStart: Date,
  existingEnd: Date
): 'OVERLAP' | 'ADJACENT' | 'CONTAINED' {
  // Check if one booking is completely contained within the other
  if ((requestStart >= existingStart && requestEnd <= existingEnd) ||
      (existingStart >= requestStart && existingEnd <= requestEnd)) {
    return 'CONTAINED';
  }

  // Check if bookings are adjacent (end time of one equals start time of another)
  if (requestStart.getTime() === existingEnd.getTime() || 
      requestEnd.getTime() === existingStart.getTime()) {
    return 'ADJACENT';
  }

  // Otherwise, it's a partial overlap
  return 'OVERLAP';
}

/**
 * Validate that an interpreter assignment won't create conflicts
 * Used as a final check before committing an assignment to the database
 * @param interpreterId - The interpreter's employee code
 * @param startTime - Start time of the booking to assign
 * @param endTime - End time of the booking to assign
 * @param excludeBookingId - Optional booking ID to exclude from conflict check (for updates)
 * @returns Promise<boolean> - true if assignment is safe, false if conflicts would occur
 */
export async function validateAssignmentSafety(
  interpreterId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: number
): Promise<boolean> {
  const conflictingBookings = await prisma.bookingPlan.findMany({
    where: {
      interpreterEmpCode: interpreterId,
      bookingStatus: {
        in: ['approve', 'waiting']
      },
      // Exclude the booking being updated if specified
      ...(excludeBookingId && {
        bookingId: {
          not: excludeBookingId
        }
      }),
      AND: [
        {
          timeStart: {
            lt: endTime
          }
        },
        {
          timeEnd: {
            gt: startTime
          }
        }
      ]
    },
    select: {
      bookingId: true
    }
  });

  return conflictingBookings.length === 0;
}