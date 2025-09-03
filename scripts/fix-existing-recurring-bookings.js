/**
 * Script to fix existing recurring bookings by running auto-assignment on child bookings
 * that don't have interpreters assigned
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixExistingRecurringBookings(dryRun = true) {
  console.log('🔧 Fixing Existing Recurring Bookings');
  console.log('====================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE RUN (changes will be applied)'}`);

  try {
    // Import the assignment function
    const { run } = await import('../lib/assignment/run.js');

    // Find all child bookings without interpreters
    const childBookingsWithoutInterpreters = await prisma.bookingPlan.findMany({
      where: {
        parentBookingId: { not: null }, // This is a child booking
        interpreterEmpCode: null,       // No interpreter assigned
        bookingStatus: { not: 'cancel' } // Not cancelled
      },
      select: {
        bookingId: true,
        parentBookingId: true,
        ownerEmpCode: true,
        meetingType: true,
        meetingRoom: true,
        timeStart: true,
        timeEnd: true,
        bookingStatus: true
      },
      orderBy: { timeStart: 'asc' }
    });

    console.log(`📊 Found ${childBookingsWithoutInterpreters.length} child bookings without interpreters`);

    if (childBookingsWithoutInterpreters.length === 0) {
      console.log('✅ No child bookings need fixing!');
      return;
    }

    // Group by parent booking for better reporting
    const groupedByParent = {};
    childBookingsWithoutInterpreters.forEach(child => {
      if (!groupedByParent[child.parentBookingId]) {
        groupedByParent[child.parentBookingId] = [];
      }
      groupedByParent[child.parentBookingId].push(child);
    });

    console.log(`📊 Affected parent bookings: ${Object.keys(groupedByParent).length}`);

    let totalProcessed = 0;
    let totalAssigned = 0;
    let totalFailed = 0;

    for (const [parentId, children] of Object.entries(groupedByParent)) {
      console.log(`\n📋 Processing Parent Booking ID: ${parentId}`);
      console.log(`   Child bookings to fix: ${children.length}`);

      // Get parent booking info for context
      const parentBooking = await prisma.bookingPlan.findUnique({
        where: { bookingId: parseInt(parentId) },
        select: {
          ownerEmpCode: true,
          meetingType: true,
          meetingRoom: true,
          interpreterEmpCode: true
        }
      });

      if (parentBooking) {
        console.log(`   Parent Info: ${parentBooking.meetingType} in ${parentBooking.meetingRoom}`);
        console.log(`   Parent Interpreter: ${parentBooking.interpreterEmpCode || 'NONE'}`);
      }

      for (const child of children) {
        console.log(`\n   🔄 Processing Child Booking ${child.bookingId}`);
        console.log(`      Time: ${child.timeStart} - ${child.timeEnd}`);
        console.log(`      Status: ${child.bookingStatus}`);

        totalProcessed++;

        if (dryRun) {
          console.log(`      🔍 DRY RUN: Would attempt auto-assignment`);
          continue;
        }

        try {
          console.log(`      🚀 Running auto-assignment...`);
          const result = await run(child.bookingId);
          
          if (result.status === 'assigned') {
            totalAssigned++;
            console.log(`      ✅ SUCCESS: Assigned to ${result.interpreterId}`);
          } else {
            console.log(`      ⚠️ NOT ASSIGNED: ${result.status} - ${result.reason}`);
            if (result.status === 'escalated') {
              totalFailed++;
            }
          }
        } catch (error) {
          totalFailed++;
          console.error(`      ❌ ERROR: Failed to assign - ${error.message}`);
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Final summary
    console.log('\n📊 FINAL SUMMARY');
    console.log('================');
    console.log(`📊 Total Child Bookings Processed: ${totalProcessed}`);
    
    if (!dryRun) {
      console.log(`📊 Successfully Assigned: ${totalAssigned}`);
      console.log(`📊 Failed to Assign: ${totalFailed}`);
      console.log(`📊 Success Rate: ${totalProcessed > 0 ? Math.round((totalAssigned / totalProcessed) * 100) : 0}%`);
      
      if (totalAssigned > 0) {
        console.log(`\n🎉 SUCCESS: Fixed ${totalAssigned} child bookings!`);
      }
      if (totalFailed > 0) {
        console.log(`\n⚠️ WARNING: ${totalFailed} bookings still need manual attention`);
      }
    } else {
      console.log(`📊 Would attempt to assign: ${totalProcessed} bookings`);
      console.log(`\n💡 To apply changes, run with: node scripts/fix-existing-recurring-bookings.js --live`);
    }

  } catch (error) {
    console.error('❌ Error fixing recurring bookings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Command line argument parsing
const args = process.argv.slice(2);
const isLiveRun = args.includes('--live') || args.includes('-l');

// Run the fix
if (require.main === module) {
  fixExistingRecurringBookings(!isLiveRun)
    .then(() => {
      console.log('\n✅ Fix process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix process failed:', error);
      process.exit(1);
    });
}

module.exports = { fixExistingRecurringBookings };