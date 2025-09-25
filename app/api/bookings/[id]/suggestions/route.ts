import { NextRequest, NextResponse } from "next/server";
import { buildSuggestions } from "@/lib/assignment/core/suggestion-service";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import prisma from "@/prisma/prisma";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const user = await prisma.employee.findUnique({ where: { empCode: parsed.empCode } });
  if (!user) return null;
  return user;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const { id } = await ctx.params;
    const bookingId = Number(id);
    
    if (!Number.isFinite(bookingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid booking ID" },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const environmentId = searchParams.get('environmentId') ? Number(searchParams.get('environmentId')) : undefined;
    const mode = searchParams.get('mode') || undefined;
    const maxCandidates = searchParams.get('maxCandidates') ? Number(searchParams.get('maxCandidates')) : 10;

    // Parse custom weights if provided
    let customWeights;
    const w_fair = searchParams.get('w_fair');
    const w_urgency = searchParams.get('w_urgency');
    const w_lrs = searchParams.get('w_lrs');
    
    if (w_fair || w_urgency || w_lrs) {
      customWeights = {
        w_fair: w_fair ? Number(w_fair) : undefined,
        w_urgency: w_urgency ? Number(w_urgency) : undefined,
        w_lrs: w_lrs ? Number(w_lrs) : undefined
      };
    }

    // Build suggestions
    const result = await buildSuggestions(
      bookingId,
      environmentId,
      mode,
      customWeights,
      maxCandidates
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error getting suggestions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "An unexpected error occurred while getting suggestions",
      },
      { status: 500 }
    );
  }
}
