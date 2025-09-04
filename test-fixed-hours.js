const { PrismaClient } = require('@prisma/client');

async function testFixedHours() {
    const prisma = new PrismaClient();

    try {
        // Get active interpreters (same as system)
        const interpreters = await prisma.employee.findMany({
            where: {
                isActive: true,
                userRoles: {
                    some: {
                        roleCode: "INTERPRETER"
                    }
                }
            },
            select: {
                empCode: true
            }
        });

        console.log('Active interpreters:', interpreters.map(i => i.empCode));

        // Simulate the fixed getInterpreterHours logic
        const fairnessWindowDays = 14;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - fairnessWindowDays);

        const bookings = await prisma.bookingPlan.findMany({
            where: {
                AND: [
                    { createdAt: { gte: cutoffDate } },
                    { bookingStatus: { not: 'cancel' } },
                    { interpreterEmpCode: { not: null } }
                ]
            },
            select: {
                interpreterEmpCode: true,
                timeStart: true,
                timeEnd: true,
                bookingId: true
            }
        });

        // Apply the fix: only include active interpreters
        const hoursMap = {};
        const activeEmpCodes = interpreters.map(i => i.empCode);

        // Initialize all active interpreters with 0 hours
        for (const interpreter of interpreters) {
            hoursMap[interpreter.empCode] = 0;
        }

        console.log('\nProcessing bookings (FIXED logic - active interpreters only):');

        for (const booking of bookings) {
            if (!booking.interpreterEmpCode) continue;

            // Only include hours for active interpreters
            if (!activeEmpCodes.includes(booking.interpreterEmpCode)) {
                console.log(`- Booking ${booking.bookingId}: ${booking.interpreterEmpCode} (SKIPPED - not active)`);
                continue;
            }

            const start = new Date(booking.timeStart);
            const end = new Date(booking.timeEnd);
            const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

            console.log(`- Booking ${booking.bookingId}: ${booking.interpreterEmpCode}, ${durationHours.toFixed(1)}h`);

            hoursMap[booking.interpreterEmpCode] = (hoursMap[booking.interpreterEmpCode] || 0) + durationHours;
        }

        console.log('\nFixed system hours (active interpreters only):');
        Object.entries(hoursMap).forEach(([empCode, hours]) => {
            console.log(`- ${empCode}: ${hours.toFixed(1)} hours`);
        });

        // Calculate gap
        const hours = Object.values(hoursMap);
        const maxHours = Math.max(...hours);
        const minHours = Math.min(...hours);
        const gap = maxHours - minHours;

        console.log(`\nFixed fairness gap: ${gap.toFixed(1)} hours (max: ${maxHours.toFixed(1)}, min: ${minHours.toFixed(1)})`);

        // Simulate assignment
        console.log('\nSimulating assignment (FIXED method):');
        interpreters.forEach(interpreter => {
            const simulatedHours = { ...hoursMap };
            simulatedHours[interpreter.empCode] = (simulatedHours[interpreter.empCode] || 0) + 1;

            const simHours = Object.values(simulatedHours);
            const simGap = Math.max(...simHours) - Math.min(...simHours);

            console.log(`- ${interpreter.empCode}: gap would be ${simGap.toFixed(1)}h (${simGap <= 10 ? '✅ PASS' : '❌ FAIL'})`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testFixedHours();