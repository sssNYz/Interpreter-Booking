import prisma from "@/prisma/prisma";
import { getModeDefaults, loadPolicy } from "./policy";
import type { AssignmentPolicy, MeetingTypePriority, MeetingTypeModeThreshold } from "@/types/assignment";

export async function getEnvironmentPolicyOverride(environmentId: number) {
  return prisma.environmentAssignmentConfig.findUnique({
    where: { environmentId }
  });
}

export async function upsertEnvironmentPolicyOverride(environmentId: number, data: Partial<AssignmentPolicy>) {
  // Allow per-environment overrides, including mode and autoAssignEnabled
  const allowed: Partial<AssignmentPolicy> & { mode?: string; autoAssignEnabled?: boolean } = {
    mode: (data as AssignmentPolicy & { mode?: string }).mode,
    autoAssignEnabled: (data as AssignmentPolicy & { autoAssignEnabled?: boolean }).autoAssignEnabled,
    fairnessWindowDays: data.fairnessWindowDays,
    maxGapHours: data.maxGapHours,
    w_fair: data.w_fair,
    w_urgency: data.w_urgency,
    w_lrs: data.w_lrs,
    drConsecutivePenalty: data.drConsecutivePenalty
  };
  return prisma.environmentAssignmentConfig.upsert({
    where: { environmentId },
    update: allowed,
    create: { environmentId, ...allowed }
  });
}

export async function getEffectivePolicyForEnvironment(environmentId: number): Promise<AssignmentPolicy & { source: Record<string, 'env'|'global'|'mode-default'> }> {
  const global = await loadPolicy();
  const env = await getEnvironmentPolicyOverride(environmentId);

  // Determine effective mode and auto-assign flag
  const effectiveMode = (env as AssignmentPolicy & { mode?: string })?.mode ?? global.mode;
  const effectiveAutoAssignEnabled = (env as AssignmentPolicy & { autoAssignEnabled?: boolean })?.autoAssignEnabled ?? global.autoAssignEnabled;

  // In non-CUSTOM modes, values come from that mode's defaults
  if (effectiveMode !== 'CUSTOM') {
    const defaults = getModeDefaults(effectiveMode as AssignmentPolicy['mode']);
    return {
      ...global,
      ...defaults,
      mode: effectiveMode as AssignmentPolicy['mode'],
      autoAssignEnabled: effectiveAutoAssignEnabled as AssignmentPolicy['autoAssignEnabled'],
      source: {
        fairnessWindowDays: 'mode-default',
        maxGapHours: 'mode-default',
        w_fair: 'mode-default',
        w_urgency: 'mode-default',
        w_lrs: 'mode-default',
        drConsecutivePenalty: 'mode-default',
        mode: (env as AssignmentPolicy & { mode?: string })?.mode !== undefined && (env as AssignmentPolicy & { mode?: string })?.mode !== null ? 'env' : 'global',
        autoAssignEnabled: (env as AssignmentPolicy & { autoAssignEnabled?: boolean })?.autoAssignEnabled !== undefined && (env as AssignmentPolicy & { autoAssignEnabled?: boolean })?.autoAssignEnabled !== null ? 'env' : 'global'
      } as Record<string, 'env'|'global'|'mode-default'>
    };
  }

  // CUSTOM mode: apply env overrides when provided, otherwise use global
  const effective: AssignmentPolicy = {
    ...global,
    mode: effectiveMode as AssignmentPolicy['mode'],
    autoAssignEnabled: effectiveAutoAssignEnabled as AssignmentPolicy['autoAssignEnabled'],
    fairnessWindowDays: env?.fairnessWindowDays ?? global.fairnessWindowDays,
    maxGapHours: env?.maxGapHours ?? global.maxGapHours,
    w_fair: env?.w_fair ?? global.w_fair,
    w_urgency: env?.w_urgency ?? global.w_urgency,
    w_lrs: env?.w_lrs ?? global.w_lrs,
    drConsecutivePenalty: env?.drConsecutivePenalty ?? global.drConsecutivePenalty
  };

  const source: Record<string, 'env'|'global'|'mode-default'> = {
    fairnessWindowDays: env?.fairnessWindowDays !== null && env?.fairnessWindowDays !== undefined ? 'env' : 'global',
    maxGapHours: env?.maxGapHours !== null && env?.maxGapHours !== undefined ? 'env' : 'global',
    w_fair: env?.w_fair !== null && env?.w_fair !== undefined ? 'env' : 'global',
    w_urgency: env?.w_urgency !== null && env?.w_urgency !== undefined ? 'env' : 'global',
    w_lrs: env?.w_lrs !== null && env?.w_lrs !== undefined ? 'env' : 'global',
    drConsecutivePenalty: env?.drConsecutivePenalty !== null && env?.drConsecutivePenalty !== undefined ? 'env' : 'global',
    mode: (env as AssignmentPolicy & { mode?: string })?.mode !== undefined && (env as AssignmentPolicy & { mode?: string })?.mode !== null ? 'env' : 'global',
    autoAssignEnabled: (env as AssignmentPolicy & { autoAssignEnabled?: boolean })?.autoAssignEnabled !== undefined && (env as AssignmentPolicy & { autoAssignEnabled?: boolean })?.autoAssignEnabled !== null ? 'env' : 'global'
  } as Record<string, 'env'|'global'|'mode-default'>;

  return Object.assign(effective, { source });
}

export async function getEnvMeetingTypePriority(environmentId: number, meetingType: string): Promise<MeetingTypePriority | null> {
  // Try environment override, then global (environmentId null)
  const env = await prisma.meetingTypePriority.findFirst({
    where: { meetingType: meetingType as any, environmentId: environmentId }, // eslint-disable-line @typescript-eslint/no-explicit-any
    orderBy: { updatedAt: 'desc' }
  });
  if (env) return env as MeetingTypePriority;

  const global = await prisma.meetingTypePriority.findFirst({
    where: { meetingType: meetingType as any, environmentId: null }, // eslint-disable-line @typescript-eslint/no-explicit-any
    orderBy: { updatedAt: 'desc' }
  });
  return global as MeetingTypePriority;
}

export async function upsertEnvMeetingTypePriority(environmentId: number, meetingType: string, data: Partial<MeetingTypePriority>) {
  const existing = await prisma.meetingTypePriority.findFirst({
    where: { environmentId, meetingType: meetingType as any } // eslint-disable-line @typescript-eslint/no-explicit-any
  });
  if (existing) {
    return prisma.meetingTypePriority.update({
      where: { id: existing.id },
      data: {
        priorityValue: data.priorityValue as number | undefined,
        urgentThresholdDays: data.urgentThresholdDays as number | undefined,
        generalThresholdDays: data.generalThresholdDays as number | undefined,
      }
    });
  }
  return prisma.meetingTypePriority.create({
    data: {
      environmentId,
      meetingType: meetingType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      priorityValue: (data.priorityValue as number) ?? 1,
      urgentThresholdDays: (data.urgentThresholdDays as number) ?? 3,
      generalThresholdDays: (data.generalThresholdDays as number) ?? 30
    }
  });
}

export async function listEnvMeetingTypePriorities(environmentId: number) {
  const envRows = await prisma.meetingTypePriority.findMany({ where: { environmentId } });
  const globalRows = await prisma.meetingTypePriority.findMany({ where: { environmentId: null } });
  return { env: envRows, global: globalRows };
}

export async function getEnvModeThreshold(environmentId: number, meetingType: string, assignmentMode: string): Promise<MeetingTypeModeThreshold | null> {
  // Model has no environmentId; return global (by meetingType + assignmentMode)
  const row = await prisma.meetingTypeModeThreshold.findFirst({
    where: { meetingType: meetingType as any, assignmentMode }, // eslint-disable-line @typescript-eslint/no-explicit-any
    orderBy: { updatedAt: 'desc' }
  });
  return row as MeetingTypeModeThreshold;
}

export async function upsertEnvModeThreshold(environmentId: number, meetingType: string, assignmentMode: string, urgentThresholdDays: number, generalThresholdDays: number) {
  // Model has no environmentId; upsert by meetingType + assignmentMode only
  const existing = await prisma.meetingTypeModeThreshold.findFirst({
    where: { meetingType: meetingType as any, assignmentMode } // eslint-disable-line @typescript-eslint/no-explicit-any
  });
  if (existing) {
    return prisma.meetingTypeModeThreshold.update({
      where: { id: existing.id },
      data: { urgentThresholdDays, generalThresholdDays }
    });
  }
  return prisma.meetingTypeModeThreshold.create({
    data: { meetingType: meetingType as any, assignmentMode, urgentThresholdDays, generalThresholdDays } // eslint-disable-line @typescript-eslint/no-explicit-any
  });
}

export async function listEnvModeThresholds(environmentId: number) {
  // No environment scoping in model; return global rows only
  const globalRows = await prisma.meetingTypeModeThreshold.findMany();
  return { env: [], global: globalRows };
}

