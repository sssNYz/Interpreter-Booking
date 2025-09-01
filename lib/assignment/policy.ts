import prisma from "@/prisma/prisma";
import type { AssignmentPolicy, MeetingTypePriority, DRPolicy } from "@/types/assignment";

const DEFAULT_POLICY: AssignmentPolicy = {
  autoAssignEnabled: true,
  mode: 'NORMAL',
  fairnessWindowDays: 30,
  maxGapHours: 5,
  minAdvanceDays: 2,
  w_fair: 1.2,
  w_urgency: 0.8,
  w_lrs: 0.3,
  drConsecutivePenalty: -0.5, // Default penalty for consecutive DR assignments (Normal mode)
};

/**
 * Get mode-specific scoring weights
 */
export function getScoringWeights(mode: string): { w_fair: number; w_urgency: number; w_lrs: number } {
  switch (mode.toUpperCase()) {
    case 'BALANCE':
      return {
        w_fair: 2.0,      // Maximize fairness
        w_urgency: 0.6,   // Slightly reduced urgency
        w_lrs: 0.6        // Enhanced rotation for fairness
      };
    case 'URGENT':
      return {
        w_fair: 0.5,      // Significantly reduced fairness
        w_urgency: 2.5,   // 2.5x more important than fairness
        w_lrs: 0.2        // Minimal rotation consideration
      };
    case 'CUSTOM':
      // For CUSTOM mode, return the current config values
      // This will be handled by the calling function
      return {
        w_fair: 1.0,      // Placeholder, will be overridden
        w_urgency: 1.0,   // Placeholder, will be overridden
        w_lrs: 1.0        // Placeholder, will be overridden
      };
    case 'NORMAL':
    default:
      return {
        w_fair: 1.2,      // Balanced fairness
        w_urgency: 0.8,   // Moderate-to-high urgency as default
        w_lrs: 0.3        // Standard rotation
      };
  }
}

/**
 * Get additional mode-defaults beyond weights
 */
export function getModeDefaults(mode: string): Pick<AssignmentPolicy, 'fairnessWindowDays' | 'maxGapHours' | 'drConsecutivePenalty' | 'w_fair' | 'w_urgency' | 'w_lrs'> {
  const upper = mode.toUpperCase();
  if (upper === 'BALANCE') {
    return {
      fairnessWindowDays: 60,
      maxGapHours: 2,
      drConsecutivePenalty: -0.8,
      ...getScoringWeights('BALANCE')
    };
  }
  if (upper === 'URGENT') {
    return {
      fairnessWindowDays: 14,
      maxGapHours: 10,
      drConsecutivePenalty: -0.1,
      ...getScoringWeights('URGENT')
    };
  }
  // NORMAL default
  return {
    fairnessWindowDays: 30,
    maxGapHours: 5,
    drConsecutivePenalty: -0.5,
    ...getScoringWeights('NORMAL')
  };
}

/**
 * Apply mode-specific thresholds to a meeting type priority when not in CUSTOM mode
 * Rules per requirements:
 * - Normal: DR urgent=1 day, general=7 days; others urgent=3, general=30
 * - Balance: same as Normal
 * - Urgent: DR urgent=0, General urgent=1; general thresholds same as Normal (DR=7, others=30)
 */
export function applyModeThresholds<T extends { meetingType: string; urgentThresholdDays: number; generalThresholdDays: number }>(
  priority: T,
  mode: string
): T {
  const upper = mode.toUpperCase();
  if (upper === 'CUSTOM') return priority;

  const isDR = priority.meetingType === 'DR';

  if (upper === 'URGENT') {
    return {
      ...priority,
      urgentThresholdDays: isDR ? 0 : 1,
      generalThresholdDays: isDR ? 7 : 30
    };
  }

  // NORMAL and BALANCE
  return {
    ...priority,
    urgentThresholdDays: isDR ? 1 : 3,
    generalThresholdDays: isDR ? 7 : 30
  };
}

/**
 * Load all meeting type priorities
 */
export async function loadMeetingTypePriorities(): Promise<MeetingTypePriority[]> {
  try {
    const priorities = await prisma.meetingTypePriority.findMany({
      orderBy: { priorityValue: 'desc' }
    });
    return priorities;
  } catch (error) {
    console.error("Error loading meeting type priorities:", error);
    return [];
  }
}

/**
 * Get meeting type priority by type
 */
export async function getMeetingTypePriority(meetingType: string): Promise<MeetingTypePriority | null> {
  try {
    const priority = await prisma.meetingTypePriority.findUnique({
      where: { meetingType: meetingType as "DR" | "VIP" | "Weekly" | "General" | "Augent" | "Other" }
    });
    return priority;
  } catch (error) {
    console.error(`Error loading priority for meeting type ${meetingType}:`, error);
    return null;
  }
}

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
  const mode = (config.mode as string) || 'NORMAL';
  const validMode = (mode === 'BALANCE' || mode === 'URGENT' || mode === 'NORMAL' || mode === 'CUSTOM') ? mode : 'NORMAL';
  
  const clamped: AssignmentPolicy = {
    autoAssignEnabled: Boolean(config.autoAssignEnabled),
    mode: validMode,
    fairnessWindowDays: Math.max(7, Math.min(90, Number(config.fairnessWindowDays) || 30)),
    maxGapHours: Math.max(1, Math.min(100, Number(config.maxGapHours) || 5)),
    minAdvanceDays: Math.max(0, Math.min(30, Number(config.minAdvanceDays) || 2)),
    w_fair: Math.max(0, Math.min(5, Number(config.w_fair) || 1.2)),
    w_urgency: Math.max(0, Math.min(5, Number(config.w_urgency) || 0.8)),
    w_lrs: Math.max(0, Math.min(5, Number(config.w_lrs) || 0.3)),
    drConsecutivePenalty: Math.max(-2.0, Math.min(0, Number(config.drConsecutivePenalty) || -0.5)),
  };

  // For non-CUSTOM modes, enforce mode-specific defaults to keep UI locked values consistent
  if (validMode !== 'CUSTOM') {
    const defaults = getModeDefaults(validMode);
    return {
      ...clamped,
      ...defaults,
    };
  }

  return clamped;
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

/**
 * Update meeting type priority
 */
export async function updateMeetingTypePriority(
  meetingType: string, 
  priority: Partial<Omit<MeetingTypePriority, 'id' | 'meetingType' | 'createdAt' | 'updatedAt'>>
): Promise<MeetingTypePriority> {
  try {
    const updated = await prisma.meetingTypePriority.update({
      where: { meetingType: meetingType as "DR" | "VIP" | "Weekly" | "General" | "Augent" | "Other" },
      data: priority
    });
    return updated;
  } catch (error) {
    console.error(`Error updating priority for meeting type ${meetingType}:`, error);
    throw new Error(`Failed to update priority for meeting type ${meetingType}`);
  }
}

/**
 * Get DR policy configuration based on mode
 */
export function getDRPolicy(mode: string): DRPolicy {
  const upper = mode.toUpperCase();
  
  switch (upper) {
    case 'BALANCE':
      return {
        scope: "GLOBAL",
        forbidConsecutive: true, // Hard block for balance mode
        consecutivePenalty: -0.8,
        includePendingInGlobal: false
      };
    case 'URGENT':
      return {
        scope: "GLOBAL", 
        forbidConsecutive: false, // Soft penalty for urgent mode
        consecutivePenalty: -0.1,
        includePendingInGlobal: true // Include pending in urgent mode
      };
    case 'CUSTOM':
      // For CUSTOM mode, return configurable values
      return {
        scope: "GLOBAL",
        forbidConsecutive: false,
        consecutivePenalty: -0.7, // Default for custom
        includePendingInGlobal: false
      };
    case 'NORMAL':
    default:
      return {
        scope: "GLOBAL",
        forbidConsecutive: false, // Soft penalty for normal mode
        consecutivePenalty: -0.5,
        includePendingInGlobal: false
      };
  }
}
