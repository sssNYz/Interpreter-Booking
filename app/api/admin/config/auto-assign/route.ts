import { NextRequest, NextResponse } from "next/server";
import { loadPolicy, updatePolicy, loadMeetingTypePriorities, updateMeetingTypePriority, applyModeThresholds } from "@/lib/assignment/policy";
import prisma from "@/prisma/prisma";

export async function GET() {
  try {
    const policy = await loadPolicy();
    const priorities = await loadMeetingTypePriorities();
    
    return NextResponse.json({
      success: true,
      data: {
        policy,
        priorities
      }
    });
  } catch (error) {
    console.error("Error loading auto-assignment config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Update policy if provided
    if (body.policy) {
      await updatePolicy(body.policy);
    }
    
    // Update meeting type priorities if provided
    if (body.priorities && Array.isArray(body.priorities)) {
      console.log(`Processing ${body.priorities.length} priorities:`, body.priorities);
      
      for (const priority of body.priorities) {
        if (priority.meetingType && priority.priorityValue !== undefined) {
          console.log(`Processing priority for ${priority.meetingType}:`, priority);
          
          try {
            // Try to update existing priority
            const activePolicy = body.policy ? await updatePolicy(body.policy) : await loadPolicy();
            const adjusted = applyModeThresholds({
              meetingType: priority.meetingType,
              urgentThresholdDays: priority.urgentThresholdDays,
              generalThresholdDays: priority.generalThresholdDays
            }, activePolicy.mode);
            await updateMeetingTypePriority(priority.meetingType, {
              priorityValue: priority.priorityValue,
              urgentThresholdDays: adjusted.urgentThresholdDays,
              generalThresholdDays: adjusted.generalThresholdDays
            });
            console.log(`Updated priority for ${priority.meetingType}`);
          } catch (error) {
            // If update fails, create new priority
            console.log(`Creating new priority for ${priority.meetingType} (update failed: ${error instanceof Error ? error.message : 'Unknown error'})`);
            await prisma.meetingTypePriority.create({
              data: {
                meetingType: priority.meetingType as "DR" | "VIP" | "Weekly" | "General" | "Augent" | "Other",
                priorityValue: priority.priorityValue,
                urgentThresholdDays: priority.urgentThresholdDays,
                generalThresholdDays: priority.generalThresholdDays
              }
            });
            console.log(`Created new priority for ${priority.meetingType}`);
          }
        }
      }
    }
    
    // Return updated configuration
    const updatedPolicy = await loadPolicy();
    const updatedPriorities = await loadMeetingTypePriorities();
    
    return NextResponse.json({
      success: true,
      data: {
        policy: updatedPolicy,
        priorities: updatedPriorities
      },
      message: "Configuration updated successfully"
    });
  } catch (error) {
    console.error("Error updating auto-assignment config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
