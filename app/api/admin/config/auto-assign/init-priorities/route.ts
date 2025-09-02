import { NextRequest, NextResponse } from "next/server";
import { createDefaultMeetingTypePriorities, loadMeetingTypePriorities } from "@/lib/assignment/policy";

export async function POST(request: NextRequest) {
    try {
        console.log("🚀 Initializing meeting type priorities via API...");

        // Check if priorities already exist
        const existingPriorities = await loadMeetingTypePriorities();

        if (existingPriorities.length > 0) {
            console.log(`✅ Found ${existingPriorities.length} existing priorities, no action needed`);
            return NextResponse.json({
                success: true,
                message: "Priorities already exist",
                data: {
                    existingCount: existingPriorities.length,
                    priorities: existingPriorities
                }
            });
        }

        // Create default priorities
        await createDefaultMeetingTypePriorities();

        // Load the newly created priorities
        const newPriorities = await loadMeetingTypePriorities();

        console.log(`🎉 Successfully created ${newPriorities.length} meeting type priorities`);

        return NextResponse.json({
            success: true,
            message: `Successfully created ${newPriorities.length} default meeting type priorities`,
            data: {
                createdCount: newPriorities.length,
                priorities: newPriorities
            }
        });

    } catch (error) {
        console.error("❌ Error initializing meeting type priorities:", error);

        return NextResponse.json({
            success: false,
            error: "Failed to initialize meeting type priorities",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const priorities = await loadMeetingTypePriorities();

        return NextResponse.json({
            success: true,
            data: {
                count: priorities.length,
                priorities: priorities
            }
        });

    } catch (error) {
        console.error("❌ Error loading meeting type priorities:", error);

        return NextResponse.json({
            success: false,
            error: "Failed to load meeting type priorities",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}