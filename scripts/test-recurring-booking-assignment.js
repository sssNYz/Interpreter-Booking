/**
 * Test script to verify that recurring bookings get auto-assignment for all child bookings
 * This script simulates the booking creation process and checks assignment results
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRecurringBookingAssignment() {
  console.log('🧪 Testing Recurring Booking Auto-Assignment Fix');
  console.log('================================================');

  try {
    // Test data for a recurring booking (daily for 3 days)
    const testBookingData = {
      ownerEmpCode: 'TEST001',
      ownerGroup: 'INTERNAL',
      meetingRoom: 'Test Room A',
      meetingType: 'General',
      meetingDetail: 'Test recurring meeting',
      timeStart: '2024-12-20 10:00:00',
      timeEnd: '2024-12-20 11:00:00',
      isRecurring: true,
      recurrenceType: 'daily',
      recurrenceInterval: 1,
      recurrenceEndType: 'after_occurrences',
      recurrenceEndOccurrences: 3, // Parent + 2 children = 3 total
      bookingStatus: 'waiting'
    };

    console.log('📋 Test booking data:', {
      meetingType: testBookingData.meetingType,
      timeStart: testBookingData.timeStart,
      timeEnd: testBookingData.timeEnd,
      recurrenceType: testBookingData.recurrenceType,
      totalOccurrences: testBookingData.recurrenceEndOccurrences
    });

    // Simulate the API call by making a POST request to our endpoint
    const response = await fetch('http://172.31.150.22:3030/api/booking-data/post-booking-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testBookingData)
    });

    const result = await response.json();
    
    console.log('\n📊 API Response Status:', response.status);
    console.log('📊 API Response:', JSON.stringify(result, null, 2));

    if (result.success && result.data.bookingId) {
      console.log('\n✅ Booking created successfully!');
      console.log(`📝 Parent Booking ID: ${result.data.bookingId}`);
      console.log(`📝 Children Created: ${result.data.recurringChildrenInserted}`);

      // Check auto-assignment results
      if (result.data.autoAssignment) {
        const autoResult = result.data.autoAssignment;
        console.log('\n🤖 Auto-Assignment Results:');
        console.log(`📊 Parent Status: ${autoResult.status}`);
        
        if (autoResult.childAssignments !== undefined) {
          console.log(`📊 Child Assignments: ${autoResult.childAssignments}/${autoResult.totalChildren}`);
          console.log(`📊 Summary: ${autoResult.message}`);
          
          if (autoResult.childResults) {
            console.log('\n📋 Individual Child Results:');
            autoResult.childResults.forEach((child, index) => {
              console.log(`  Child ${index + 1} (ID: ${child.bookingId}): ${child.result.status}`);
              if (child.result.interpreterId) {
                console.log(`    ✅ Assigned to: ${child.result.interpreterId}`);
              } else {
                console.log(`    ⚠️ Reason: ${child.result.reason}`);
              }
            });
          }
        }

        // Verify in database
        console.log('\n🔍 Database Verification:');
        
        // Check parent booking
        const parentBooking = await prisma.bookingPlan.findUnique({
          where: { bookingId: result.data.bookingId },
          select: { 
            bookingId: true, 
            interpreterEmpCode: true, 
            bookingStatus: true,
            timeStart: true,
            timeEnd: true
          }
        });
        
        console.log(`📝 Parent Booking:`, {
          id: parentBooking?.bookingId,
          interpreter: parentBooking?.interpreterEmpCode || 'NONE',
          status: parentBooking?.bookingStatus,
          time: `${parentBooking?.timeStart} - ${parentBooking?.timeEnd}`
        });

        // Check child bookings
        const childBookings = await prisma.bookingPlan.findMany({
          where: { parentBookingId: result.data.bookingId },
          select: { 
            bookingId: true, 
            interpreterEmpCode: true, 
            bookingStatus: true,
            timeStart: true,
            timeEnd: true
          },
          orderBy: { timeStart: 'asc' }
        });

        console.log(`📝 Child Bookings (${childBookings.length}):`);
        childBookings.forEach((child, index) => {
          console.log(`  Child ${index + 1}:`, {
            id: child.bookingId,
            interpreter: child.interpreterEmpCode || 'NONE',
            status: child.bookingStatus,
            time: `${child.timeStart} - ${child.timeEnd}`
          });
        });

        // Summary
        const totalBookings = 1 + childBookings.length;
        const assignedBookings = [parentBooking, ...childBookings].filter(b => b?.interpreterEmpCode).length;
        
        console.log('\n📊 Final Summary:');
        console.log(`📊 Total Bookings Created: ${totalBookings}`);
        console.log(`📊 Bookings with Interpreters: ${assignedBookings}`);
        console.log(`📊 Success Rate: ${Math.round((assignedBookings / totalBookings) * 100)}%`);
        
        if (assignedBookings === totalBookings) {
          console.log('🎉 SUCCESS: All recurring bookings have interpreters assigned!');
        } else {
          console.log('⚠️ PARTIAL SUCCESS: Some bookings still need interpreters');
        }

      } else {
        console.log('❌ No auto-assignment result found');
      }

    } else {
      console.log('❌ Booking creation failed:', result.error || result.message);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testRecurringBookingAssignment()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testRecurringBookingAssignment };