import prisma from "@/prisma/prisma";
import type { AssignmentPolicy } from "@/types/assignment";

const DEFAULT_POLICY: AssignmentPolicy = {
  autoAssignEnabled: true,
  fairnessWindowDays: 30,
  maxGapHours: 10,
  minAdvanceDays: 2,
  w_fair: 1.2,
  w_urgency: 0.5,
  w_lrs: 0.3,
};

/**
 * Load active auto-assignment policy with safe defaults
 */
export async function loadPolicy(): Promise<AssignmentPolicy> {
  try {
    const config = await prisma.autoAssignmentConfig.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (!config) {
      // Create default config if none exists
      const defaultConfig = await prisma.autoAssignmentConfig.create({
        data: DEFAULT_POLICY
      });
      return validateAndClampPolicy(defaultConfig);
    }

    return validateAndClampPolicy(config);
  } catch (error) {
    console.error("Error loading assignment policy:", error);
    return DEFAULT_POLICY;
  }
}

/**
 * Validate and clamp policy values to safe ranges
 */
function validateAndClampPolicy(config: Record<string, unknown>): AssignmentPolicy {
  return {
    autoAssignEnabled: Boolean(config.autoAssignEnabled),
    fairnessWindowDays: Math.max(7, Math.min(90, Number(config.fairnessWindowDays) || 30)),
    maxGapHours: Math.max(1, Math.min(100, Number(config.maxGapHours) || 10)),
    minAdvanceDays: Math.max(0, Math.min(30, Number(config.minAdvanceDays) || 2)),
    w_fair: Math.max(0, Math.min(5, Number(config.w_fair) || 1.2)),
    w_urgency: Math.max(0, Math.min(5, Number(config.w_urgency) || 0.5)),
    w_lrs: Math.max(0, Math.min(5, Number(config.w_lrs) || 0.3)),
  };
}

/**
 * Update the active policy
 */
export async function updatePolicy(policy: Partial<AssignmentPolicy>): Promise<AssignmentPolicy> {
  try {
    const existing = await prisma.autoAssignmentConfig.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (existing) {
      const updated = await prisma.autoAssignmentConfig.update({
        where: { id: existing.id },
        data: policy
      });
      return validateAndClampPolicy(updated);
    } else {
      const created = await prisma.autoAssignmentConfig.create({
        data: { ...DEFAULT_POLICY, ...policy }
      });
      return validateAndClampPolicy(created);
    }
  } catch (error) {
    console.error("Error updating assignment policy:", error);
    throw new Error("Failed to update assignment policy");
  }
}
