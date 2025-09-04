import { NextRequest, NextResponse } from "next/server";
import { loadPolicy, loadMeetingTypePriorities } from "@/lib/assignment/config/policy";
import { validateAssignmentPolicy } from "@/lib/assignment/validation/config-validation";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Debug: Loading current configuration...");
    
    const policy = await loadPolicy();
    const priorities = await loadMeetingTypePriorities();
    
    console.log("📋 Current policy:", policy);
    console.log("📋 Current priorities:", priorities);
    
    // Test validation
    const validation = validateAssignmentPolicy(policy, policy);
    console.log("🔍 Validation result:", validation);
    
    return NextResponse.json({
      success: true,
      debug: {
        policy,
        priorities,
        validation,
        prioritiesCount: priorities.length,
        policyValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      }
    });
    
  } catch (error) {
    console.error("❌ Debug error:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("🔍 Debug: Testing save with payload:", body);
    
    const currentPolicy = await loadPolicy();
    const validation = validateAssignmentPolicy(body.policy || {}, currentPolicy);
    
    console.log("🔍 Validation result for test payload:", validation);
    
    return NextResponse.json({
      success: true,
      debug: {
        receivedPayload: body,
        currentPolicy,
        validation,
        wouldSave: validation.isValid
      }
    });
    
  } catch (error) {
    console.error("❌ Debug POST error:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}