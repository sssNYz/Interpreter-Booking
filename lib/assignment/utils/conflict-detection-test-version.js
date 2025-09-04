/**
 * Test version of conflict detection functions
 * This version uses a mock Prisma instance for testing
 */

// Mock Prisma for testing - will be replaced with actual import in production
let prisma;
if (process.env.NODE_ENV === 'test') {
  // Use mock for testing
  prisma = global.mockPrisma || {
    bookingPlan: {
      findMany: async () => []
    }
  };
} else {
  // Use real Prisma in production
  try {
    prisma = require('@/prisma/prisma').default;
  } catch (e) {
    // Fallback for testing environment
    prisma = {
      bookingPlan: {
        findMany: async () => []
      }
    };
  }
}

/**
 * Check if an interpreter is available during the specified time period
 */
async function checkInterpreterAvailability(interpreterId, startTime, endTime) {
  const conflicts = await getConflictingBookings(interpreterId, startTime, endTime);
  return conflicts.length === 0;
}

/**
 * Get detailed information about conflicting bookings for an interpreter
 */
async function getConflictingBookings(interpreterId, startTime, endTime) {
  const conflictingBookings = await prisma.bookingPlan.findMany({
    where: {
      interpreterEmpCode: interpreterId,
      bookingStatus: {
        in: ['approve', 'waiting']
      },
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
      bookingId: true,
      timeStart: true,
      timeEnd: true,
      meetingType: true
    }
  });

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
 */
async function filterAvailableInterpreters(interpreterIds, startTime, endTime) {
  const availableInterpreters = [];

  for (const interpreterId of interpreterIds) {
    const isAvailable = await checkInterpreterAvailability(interpreterId, startTime, endTime);
    if (isAvailable) {
      availableInterpreters.push(interpreterId);
    }
  }

  return availableInterpreters;
}

/**
 * Validate that an interpreter assignment won't create conflicts
 */
async function validateAssignmentSafety(interpreterId, startTime, endTime, excludeBookingId) {
  const conflictingBookings = await prisma.bookingPlan.findMany({
    where: {
      interpreterEmpCode: interpreterId,
      bookingStatus: {
        in: ['approve', 'waiting']
      },
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

/**
 * Determine the type of time conflict between two time periods
 */
function determineConflictType(requestStart, requestEnd, existingStart, existingEnd) {
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

module.exports = {
  checkInterpreterAvailability,
  getConflictingBookings,
  filterAvailableInterpreters,
  validateAssignmentSafety,
  determineConflictType
};