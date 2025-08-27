import { NextRequest, NextResponse } from "next/server";
import { loadPolicy, updatePolicy } from "@/lib/assignment/policy";
import type { AssignmentPolicy } from "@/types/assignment";

export async function GET() {
  try {
    const policy = await loadPolicy();
    
    return NextResponse.json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error("Error fetching auto-assign config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch configuration"
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { autoAssignEnabled, fairnessWindowDays, maxGapHours, minAdvanceDays, w_fair, w_urgency, w_lrs } = body;
    
    // Basic validation
    if (typeof autoAssignEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: "autoAssignEnabled must be a boolean" },
        { status: 400 }
      );
    }
    
    if (fairnessWindowDays !== undefined && (typeof fairnessWindowDays !== 'number' || fairnessWindowDays < 7 || fairnessWindowDays > 90)) {
      return NextResponse.json(
        { success: false, error: "fairnessWindowDays must be between 7 and 90" },
        { status: 400 }
      );
    }
    
    if (maxGapHours !== undefined && (typeof maxGapHours !== 'number' || maxGapHours < 1 || maxGapHours > 100)) {
      return NextResponse.json(
        { success: false, error: "maxGapHours must be between 1 and 100" },
        { status: 400 }
      );
    }
    
    if (minAdvanceDays !== undefined && (typeof minAdvanceDays !== 'number' || minAdvanceDays < 0 || minAdvanceDays > 30)) {
      return NextResponse.json(
        { success: false, error: "minAdvanceDays must be between 0 and 30" },
        { status: 400 }
      );
    }
    
    if (w_fair !== undefined && (typeof w_fair !== 'number' || w_fair < 0 || w_fair > 5)) {
      return NextResponse.json(
        { success: false, error: "w_fair must be between 0 and 5" },
        { status: 400 }
      );
    }
    
    if (w_urgency !== undefined && (typeof w_urgency !== 'number' || w_urgency < 0 || w_urgency > 5)) {
      return NextResponse.json(
        { success: false, error: "w_urgency must be between 0 and 5" },
        { status: 400 }
      );
    }
    
    if (w_lrs !== undefined && (typeof w_lrs !== 'number' || w_lrs < 0 || w_lrs > 5)) {
      return NextResponse.json(
        { success: false, error: "w_lrs must be between 0 and 5" },
        { status: 400 }
      );
    }
    
    // Update policy
    const updatedPolicy = await updatePolicy(body);
    
    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      data: updatedPolicy
    });
  } catch (error) {
    console.error("Error updating auto-assign config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update configuration"
      },
      { status: 500 }
    );
  }
}
