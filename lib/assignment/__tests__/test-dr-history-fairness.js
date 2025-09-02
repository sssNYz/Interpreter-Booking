// Simple test for DR history fairness window functionality
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFairnessWindow() {
    console.log('🧪 Testing DR History Fairness Window Integration...');

    const testBookingIds = [];

    try {
        // Get existing employees to use for testing
        const existingEmployees = await prisma.employee.findMany({
            where: { isActive: true },
            select: { empCode: true },
            take: 4
        });

        if (existingEmployees.length < 3) {
            console.log('❌ Need at least 3 active employees in database. Skipping tests.');
            return;
        }

        const ownerEmpCode = existingEmployees[0].empCode;
        const testInterpreterIds = [
            existingEmployees[1].empCode,
            existingEmployees[2].empCode,
            existingEmployees[3]?.empCode || existingEmployees[1].empCode
        ];

        console.log(`📋 Using owner employee: ${ownerEmpCode}`);
        console.log(`📋 Using test interpreters: ${testInterpreterIds.join(', ')}`);

        // Clean up any existing test data
        await prisma.bookingPlan.deleteMany({
            where: {
                interpreterEmpCode: { in: testInterpreterIds }
            }
        });

        const now = new Date();
        const fairnessWindowDays = 30;

        // Test 1: Create DR assignments inside and outside fairness window
        console.log('📅 Test 1: Fairness window scoping...');

        // Create a DR assignment outside the fairness window (35 days ago)
        const oldAssignmentDate = new Date(now);
        oldAssignmentDate.setDate(oldAssignmentDate.getDate() - 35);

        const oldBooking = await prisma.bookingPlan.create({
            data: {
                timeStart: oldAssignmentDate,
                timeEnd: new Date(oldAssignmentDate.getTime() + 60 * 60 * 1000),
                meetingType: 'DR',
                interpreterEmpCode: testInterpreterIds[0],
                bookingStatus: 'approve',
                meetingDetail: 'Test DR meeting - old',
                ownerEmpCode: ownerEmpCode,
                ownerGroup: 'software',
                meetingRoom: 'TEST_ROOM'
            }
        });
        testBookingIds.push(oldBooking.bookingId);

        // Create a DR assignment within the fairness window (20 days ago)
        const recentAssignmentDate = new Date(now);
        recentAssignmentDate.setDate(recentAssignmentDate.getDate() - 20);

        const recentBooking = await prisma.bookingPlan.create({
            data: {
                timeStart: recentAssignmentDate,
                timeEnd: new Date(recentAssignmentDate.getTime() + 60 * 60 * 1000),
                meetingType: 'DR',
                interpreterEmpCode: testInterpreterIds[0],
                bookingStatus: 'approve',
                meetingDetail: 'Test DR meeting - recent',
                ownerEmpCode: ownerEmpCode,
                ownerGroup: 'software',
                meetingRoom: 'TEST_ROOM'
            }
        });
        testBookingIds.push(recentBooking.bookingId);

        // Import and test the DR history function
        const { checkDRAssignmentHistory } = await import('../dr-history.ts');

        const history = await checkDRAssignmentHistory(
            testInterpreterIds[0],
            fairnessWindowDays
        );

        console.log(`✅ DR History check: Found ${history.lastDRAssignments.length} assignments within window`);
        console.log(`   Expected: 1 (recent only), Got: ${history.lastDRAssignments.length}`);

        if (history.lastDRAssignments.length === 1 &&
            history.lastDRAssignments[0].bookingId === recentBooking.bookingId) {
            console.log('✅ Test 1 PASSED: Fairness window correctly scoped assignments');
        } else {
            console.log('❌ Test 1 FAILED: Fairness window scoping issue');
        }

        // Test 2: Dynamic pool adjustment
        console.log('\n🔄 Test 2: Dynamic pool adjustment...');

        const { adjustForDynamicPool } = await import('../dr-history.ts');

        // Create some history for one interpreter
        const historyDate = new Date(now);
        historyDate.setDate(historyDate.getDate() - 15);

        const generalBooking = await prisma.bookingPlan.create({
            data: {
                timeStart: historyDate,
                timeEnd: new Date(historyDate.getTime() + 60 * 60 * 1000),
                meetingType: 'General',
                interpreterEmpCode: testInterpreterIds[0],
                bookingStatus: 'approve',
                meetingDetail: 'Test general meeting',
                ownerEmpCode: ownerEmpCode,
                ownerGroup: 'software',
                meetingRoom: 'TEST_ROOM'
            }
        });
        testBookingIds.push(generalBooking.bookingId);

        const interpreterPool = [testInterpreterIds[0], testInterpreterIds[1], testInterpreterIds[2]];
        const adjustment = await adjustForDynamicPool(
            interpreterPool,
            fairnessWindowDays,
            now
        );

        console.log(`✅ Pool adjustment: ${adjustment.newInterpreters.length} new interpreters detected`);
        console.log(`   Adjustment factor: ${adjustment.adjustmentFactor.toFixed(2)}`);
        console.log(`   Pool change detected: ${adjustment.poolChangeDetected}`);

        if (adjustment.newInterpreters.includes(testInterpreterIds[1]) &&
            adjustment.newInterpreters.includes(testInterpreterIds[2]) &&
            adjustment.poolChangeDetected &&
            adjustment.adjustmentFactor > 1.0) {
            console.log('✅ Test 2 PASSED: Dynamic pool adjustment working correctly');
        } else {
            console.log('❌ Test 2 FAILED: Dynamic pool adjustment issue');
        }

        // Test 3: Last global DR with fairness window
        console.log('\n🌍 Test 3: Last global DR with fairness window...');

        const { getLastGlobalDRAssignment } = await import('../dr-history.ts');

        // Get last global DR without fairness window constraint
        const lastGlobalAll = await getLastGlobalDRAssignment(now);
        console.log(`   Last global DR (all time): ${lastGlobalAll.interpreterEmpCode}`);

        // Get last global DR within fairness window
        const lastGlobalWindowed = await getLastGlobalDRAssignment(now, {
            fairnessWindowDays
        });
        console.log(`   Last global DR (windowed): ${lastGlobalWindowed.interpreterEmpCode}`);

        if (lastGlobalAll.interpreterEmpCode === testInterpreterIds[0] &&
            lastGlobalWindowed.interpreterEmpCode === testInterpreterIds[0]) {
            console.log('✅ Test 3 PASSED: Last global DR retrieval working correctly');
        } else {
            console.log('❌ Test 3 FAILED: Last global DR retrieval issue');
        }

        console.log('\n🎉 All fairness window tests completed!');

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        // Clean up test data
        if (testBookingIds.length > 0) {
            await prisma.bookingPlan.deleteMany({
                where: {
                    bookingId: { in: testBookingIds }
                }
            });
            console.log(`🧹 Cleaned up ${testBookingIds.length} test bookings`);
        }

        await prisma.$disconnect();
    }
}

// Run the test
testFairnessWindow().catch(console.error);