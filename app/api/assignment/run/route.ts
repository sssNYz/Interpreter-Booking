import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/assignment/run";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId || typeof bookingId !== 'number') {
      return NextResponse.json(
        { success: false, error: "bookingId is required and must be a number" },
        { status: 400 }
      );
    }

    // Run auto-assignment
    const result = await run(bookingId);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error running auto-assignment:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run auto-assignment"
      },
      { status: 500 }
    );
  }
}
