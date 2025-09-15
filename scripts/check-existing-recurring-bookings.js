/**
 * Script to check existing recurring bookings and identify child bookings without interpreters
 * This helps identify the scope of the problem before applying the fix
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkExistingRecurringBookings() {
  console.log('🔍 Checking Existing Recurring Bookings');
  console.log('=====================================');

  try {
    // Find all parent bookings (recurring bookings)
    const parentBookings = await prisma.bookingPlan.findMany({
      where: {
        isRecurring: true,
        parentBookingId: null // These are parent bookings
      },
      select: {
        bookingId: true,
        ownerEmpCode: true,
        meetingType: true,
        meetingRoom: true,
        timeStart: true,
        timeEnd: true,
        interpreterEmpCode: true,
        bookingStatus: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${parentBookings.length} recurring parent bookings`);

    if (parentBookings.length === 0) {
      console.log('ℹ️ No recurring bookings found in the system');
      return;
    }

    let totalIssues = 0;
    let totalChildrenWithoutInterpreters = 0;
    let totalChildren = 0;

    for (const parent of parentBookings) {
      console.log(`\n📋 Checking Parent Booking ID: ${parent.bookingId}`);
      console.log(`   Owner: ${parent.ownerEmpCode}`);
      console.log(`   Meeting: ${parent.meetingType} in ${parent.meetingRoom}`);
      console.log(`   Time: ${parent.timeStart} - ${parent.timeEnd}`);
      console.log(`   Parent Interpreter: ${parent.interpreterEmpCode || 'NONE'}`);
      console.log(`   Parent Status: ${parent.bookingStatus}`);

      // Find all child bookings for this parent
      const childBookings = await prisma.bookingPlan.findMany({
        where: {
          parentBookingId: parent.bookingId
        },
        select: {
          bookingId: true,
          interpreterEmpCode: true,
          bookingStatus: true,
          timeStart: true,
          timeEnd: true
        },
        orderBy: { timeStart: 'asc' }
      });

      console.log(`   📝 Child Bookings: ${childBookings.length}`);
      totalChildren += childBookings.length;

      if (childBookings.length === 0) {
        console.log('   ⚠️ No child bookings found (this might be normal for single occurrence)');
        continue;
      }

      let childrenWithoutInterpreters = 0;
      let hasIssue = false;

      childBookings.forEach((child, index) => {
        const hasInterpreter = child.interpreterEmpCode !== null;
        const status = hasInterpreter ? '✅' : '❌';
        
        console.log(`     Child ${index + 1} (ID: ${child.bookingId}): ${status} ${child.interpreterEmpCode || 'NO INTERPRETER'}`);
        console.log(`       Time: ${child.timeStart} - ${child.timeEnd}`);
        console.log(`       Status: ${child.bookingStatus}`);

        if (!hasInterpreter) {
          childrenWithoutInterpreters++;
          hasIssue = true;
        }
      });

      if (hasIssue) {
        totalIssues++;
        totalChildrenWithoutInterpreters += childrenWithoutInterpreters;
        console.log(`   🚨 ISSUE: ${childrenWithoutInterpreters}/${childBookings.length} child bookings missing interpreters`);
      } else {
        console.log(`   ✅ All child bookings have interpreters assigned`);
      }
    }

    // Summary
    console.log('\n📊 SUMMARY REPORT');
    console.log('=================');
    console.log(`📊 Total Recurring Parent Bookings: ${parentBookings.length}`);
    console.log(`📊 Total Child Bookings: ${totalChildren}`);
    console.log(`📊 Parent Bookings with Issues: ${totalIssues}`);
    console.log(`📊 Child Bookings Missing Interpreters: ${totalChildrenWithoutInterpreters}`);
    
    if (totalIssues > 0) {
      console.log(`\n🚨 CRITICAL ISSUE DETECTED:`);
      console.log(`   ${totalIssues} recurring booking groups have child bookings without interpreters`);
      console.log(`   ${totalChildrenWithoutInterpreters} individual child bookings need interpreter assignment`);
      console.log(`\n💡 RECOMMENDATION:`);
      console.log(`   1. Apply the recurring booking auto-assignment fix`);
      console.log(`   2. Run manual assignment for existing affected bookings`);
      console.log(`   3. Test with new recurring bookings to verify fix`);
    } else {
      console.log(`\n✅ NO ISSUES FOUND:`);
      console.log(`   All recurring bookings have interpreters properly assigned`);
    }

    // Additional statistics
    if (totalChildren > 0) {
      const assignmentRate = Math.round(((totalChildren - totalChildrenWithoutInterpreters) / totalChildren) * 100);
      console.log(`\n📈 Child Booking Assignment Rate: ${assignmentRate}%`);
    }

  } catch (error) {
    console.error('❌ Error checking recurring bookings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
if (require.main === module) {
  checkExistingRecurringBookings()
    .then(() => {
      console.log('\n✅ Check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkExistingRecurringBookings };