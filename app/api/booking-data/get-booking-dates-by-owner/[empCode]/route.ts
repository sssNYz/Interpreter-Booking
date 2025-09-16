import prisma from "@/prisma/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ empCode: string }> }
) {
  const { empCode: empCodeRaw } = await context.params;
  const empCode = (empCodeRaw || "").trim();
  if (!empCode) {
    return new Response(JSON.stringify({ error: "Missing empCode" }), {
      status: 400,
    });
  }

  const rows = await prisma.bookingPlan.findMany({
    where: { ownerEmpCode: empCode },
    select: { timeStart: true },
    orderBy: { timeStart: "desc" },
  });

  const toYMD = (d: Date) => d.toISOString().split("T")[0];
  const dates = Array.from(new Set(rows.map((r) => toYMD(r.timeStart))));

  return new Response(JSON.stringify({ dates }), {
    headers: { "Content-Type": "application/json" },
  });
}


