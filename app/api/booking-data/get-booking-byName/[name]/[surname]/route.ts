import prisma from '@/prisma/prisma';

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: { name: string; surname: string } }
) {
  const { name, surname } = await context.params;

  const bookings = await prisma.bookingPlan.findMany({
    where: {
      ownerName: name,
      ownerSurname: surname,
    },
  });

  return new Response(JSON.stringify(bookings), {
    headers: { "Content-Type": "application/json" },
  });
}
