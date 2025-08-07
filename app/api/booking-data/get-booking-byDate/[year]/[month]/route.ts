import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: { year: string; month: string } }
) {
  const { year, month } = await context.params;

  const yearNum = parseInt(year);
  const monthNum = parseInt(month);

  if (
    isNaN(yearNum) ||
    isNaN(monthNum) ||
    monthNum < 1 ||
    monthNum > 12 ||
    yearNum < 2000
  ) {
    return new Response(JSON.stringify({ error: "Invalid year or month" }), {
      status: 400,
    });
  }

  const startDate = new Date(yearNum, monthNum - 1, 1);
  const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

  const bookings = await prisma.bookingPlan.findMany({
    where: {
      timeStart: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { timeStart: "asc" },
  });

  // ✅ ไม่แปลง timezone ซ้ำ เพราะเวลาใน DB เป็น local แล้ว
  const bookingsWithLocalTime = bookings.map((b) => {
    return {
      ...b,
      timeStart: b.timeStart, // ❌ ไม่มี timezone!
      timeEnd: b.timeEnd,
    };
  });

  return new Response(JSON.stringify(bookingsWithLocalTime), {
    headers: { "Content-Type": "application/json" },
  });
}
