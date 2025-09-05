/**
 * Test script to verify the deadline timezone fix
 * This script tests the database time comparison approach
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDeadlineComparison() {
  console.log('🧪 Testing deadline comparison fix...');
  
  try {
    // Test 1: Check current database time vs JavaScript time
    console.log('\n📅 Time Comparison Test:');
    
    const dbTimeResult = await prisma.$queryRaw`SELECT NOW() as db_time`;
    const jsTime = new Date();
    
    console.log(`Database time: ${dbTimeResult[0].db_time}`);
    console.log(`JavaScript time: ${jsTime.toISOString()}`);
    console.log(`Time difference: ${Math.abs(dbTimeResult[0].db_time.getTime() - jsTime.getTime())}ms`);
    
    // Test 2: Check the actual booking with deadline
    console.log('\n🔍 Booking Deadline Test:');
    
    const bookingWithDeadline = await prisma.$queryRaw`
      SELECT 
        BOOKING_ID,
        POOL_DEADLINE_TIME,
        NOW() as current_db_time,
        CASE 
          WHEN POOL_DEADLINE_TIME <= NOW() THEN 'PAST_DEADLINE'
          ELSE 'BEFORE_DEADLINE'
        END as deadline_status
      FROM BOOKING_PLAN 
      WHERE BOOKING_ID = 1
    `;
    
    if (bookingWithDeadline.length > 0) {
      const booking = bookingWithDeadline[0];
      console.log(`Booking ID: ${booking.BOOKING_ID}`);
      console.log(`Deadline Time: ${booking.POOL_DEADLINE_TIME}`);
      console.log(`Current DB Time: ${booking.current_db_time}`);
      console.log(`Status: ${booking.deadline_status}`);
      
      // Test the new query approach
      console.log('\n🔧 Testing New Query Approach:');
      
      const deadlineEntries = await prisma.$queryRaw`
        SELECT BOOKING_ID, POOL_DEADLINE_TIME, NOW() as check_time
        FROM BOOKING_PLAN 
        WHERE POOL_STATUS IN ('waiting', 'ready') 
        AND POOL_DEADLINE_TIME <= NOW()
        ORDER BY POOL_DEADLINE_TIME ASC
      `;
      
      console.log(`Found ${deadlineEntries.length} entries past deadline using database time`);
      
      deadlineEntries.forEach(entry => {
        console.log(`  - Booking ${entry.BOOKING_ID}: deadline ${entry.POOL_DEADLINE_TIME}, checked at ${entry.check_time}`);
      });
      
    } else {
      console.log('No booking found with ID 1');
    }
    
    // Test 3: Compare old vs new approach
    console.log('\n⚖️ Old vs New Approach Comparison:');
    
    // Old approach (using JavaScript Date)
    const jsNow = new Date();
    const oldApproachResults = await prisma.bookingPlan.findMany({
      where: {
        poolStatus: {
          in: ['waiting', 'ready']
        },
        poolDeadlineTime: {
          lte: jsNow
        }
      },
      select: {
        bookingId: true,
        poolDeadlineTime: true
      }
    });
    
    // New approach (using database NOW())
    const newApproachResults = await prisma.$queryRaw`
      SELECT BOOKING_ID as bookingId, POOL_DEADLINE_TIME as poolDeadlineTime
      FROM BOOKING_PLAN 
      WHERE POOL_STATUS IN ('waiting', 'ready') 
      AND POOL_DEADLINE_TIME <= NOW()
    `;
    
    console.log(`Old approach found: ${oldApproachResults.length} entries`);
    console.log(`New approach found: ${newApproachResults.length} entries`);
    
    if (oldApproachResults.length !== newApproachResults.length) {
      console.log('⚠️ Different results detected - timezone issue confirmed!');
      console.log('Old approach entries:', oldApproachResults.map(e => e.bookingId));
      console.log('New approach entries:', newApproachResults.map(e => e.bookingId));
    } else {
      console.log('✅ Both approaches return same results');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDeadlineComparison().catch(console.error);