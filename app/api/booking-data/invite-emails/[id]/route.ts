import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const bookingId = Number(id);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return NextResponse.json({ success: false, error: "INVALID_ID" }, { status: 400 });
    }

    const rows = await prisma.inviteEmailList.findMany({
      where: { bookingId },
      select: { email: true },
      orderBy: { invitedAt: "asc" },
    });
    const emails = rows.map((r) => r.email).filter((e) => typeof e === "string" && e.trim().length > 0);
    return NextResponse.json({ success: true, emails });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

