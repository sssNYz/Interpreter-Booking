import prisma from "@/prisma/prisma";
import { getEffectivePolicyForEnvironment } from "@/lib/assignment/config/env-policy";
import { applyModeThresholds, getMeetingTypePriority } from "@/lib/assignment/config/policy";
import { getEnvMeetingTypePriority } from "@/lib/assignment/config/env-policy";
import { centerPart } from "@/utils/users";

/** Resolve environmentId for a booking by forward target or owner's center. */
export async function getEnvironmentIdForBooking(bookingId: number): Promise<number | null> {
  const forward = await prisma.bookingForwardTarget.findFirst({
    where: { bookingId },
    select: { environmentId: true },
    orderBy: { createdAt: 'desc' }
  });
  if (forward?.environmentId != null) return forward.environmentId;

  // fallback: resolve from owner's center
  const booking = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    select: { employee: { select: { deptPath: true } } }
  });
  const center = centerPart(booking?.employee?.deptPath ?? null);
  if (!center) return null;
  const envCenter = await prisma.environmentCenter.findUnique({ where: { center }, select: { environmentId: true } });
  return envCenter?.environmentId ?? null;
}

/** Compute autoAssignAt (timeStart - generalThresholdDays) using real DB thresholds and mode. */
export async function computeAutoAssignAt(bookingId: number): Promise<{ autoAssignAt: Date | null; generalThresholdDays: number; urgentThresholdDays: number; environmentId: number | null; mode: string; autoAssignEnabled: boolean } | null> {
  const booking = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    select: { bookingId: true, timeStart: true, meetingType: true }
  });
  if (!booking) return null;

  const environmentId = await getEnvironmentIdForBooking(bookingId);

  // Load effective policy (mode + env autoAssignEnabled)
  const effectivePolicy = environmentId != null
    ? await getEffectivePolicyForEnvironment(environmentId)
    : await (async () => {
        const { loadPolicy } = await import("@/lib/assignment/config/policy");
        return loadPolicy();
      })();

  // Load thresholds for this meeting type
  const basePriority = environmentId != null
    ? (await getEnvMeetingTypePriority(environmentId, booking.meetingType)) ?? (await getMeetingTypePriority(booking.meetingType))
    : await getMeetingTypePriority(booking.meetingType);

  // Fallback defaults if none present
  const pri = basePriority ?? { meetingType: booking.meetingType, urgentThresholdDays: 3, generalThresholdDays: 30 } as any;
  const withMode = applyModeThresholds(pri, effectivePolicy.mode);

  const generalDays = withMode.generalThresholdDays ?? 30;
  const urgentDays = withMode.urgentThresholdDays ?? 1;

  const ts = new Date(booking.timeStart);
  const at = new Date(ts.getTime() - generalDays * 24 * 60 * 60 * 1000);

  return {
    autoAssignAt: at,
    generalThresholdDays: generalDays,
    urgentThresholdDays: urgentDays,
    environmentId,
    mode: effectivePolicy.mode,
    autoAssignEnabled: Boolean((effectivePolicy as any).autoAssignEnabled)
  };
}

/**
 * Compute ETA-related timestamps for a booking.
 * - urgentFrom = timeStart - urgentThresholdDays
 * - schedulerFrom = autoAssignAt (from computeAutoAssignAt for consistency)
 * - firstAutoAssignAt = max(urgentFrom, schedulerFrom)
 * - etaSeconds = seconds until firstAutoAssignAt (0 if past)
 */
export async function computeETAForBooking(bookingId: number): Promise<{
  bookingId: number;
  timeStart: Date;
  mode: string;
  environmentId: number | null;
  urgentThresholdDays: number;
  generalThresholdDays: number;
  urgentFrom: Date;
  schedulerFrom: Date | null;
  firstAutoAssignAt: Date | null;
  etaSeconds: number;
}> {
  const booking = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    select: { bookingId: true, timeStart: true }
  });
  if (!booking) {
    throw new Error("Booking not found");
  }

  const meta = await computeAutoAssignAt(bookingId);
  if (!meta) {
    throw new Error("Unable to compute auto-assign metadata");
  }

  const now = Date.now();
  const ts = new Date(booking.timeStart);
  const urgentFrom = new Date(ts.getTime() - meta.urgentThresholdDays * 24 * 60 * 60 * 1000);
  const schedulerFrom = meta.autoAssignAt;

  let firstAutoAssignAt: Date | null = null;
  if (schedulerFrom) {
    firstAutoAssignAt = urgentFrom > schedulerFrom ? urgentFrom : schedulerFrom;
  } else {
    firstAutoAssignAt = urgentFrom;
  }

  const etaSeconds = Math.max(0, Math.floor(((firstAutoAssignAt?.getTime() ?? now) - now) / 1000));

  return {
    bookingId: booking.bookingId,
    timeStart: ts,
    mode: meta.mode,
    environmentId: meta.environmentId,
    urgentThresholdDays: meta.urgentThresholdDays,
    generalThresholdDays: meta.generalThresholdDays,
    urgentFrom,
    schedulerFrom,
    firstAutoAssignAt,
    etaSeconds
  };
}

/**
 * Compute and persist scheduling fields for a booking.
 * - Sets AUTO_ASSIGN_AT
 * - Sets AUTO_ASSIGN_STATUS: 'pending' if auto-assign enabled and not assigned; otherwise 'skipped' or 'done'
 */
export async function scheduleAutoAssignForBooking(bookingId: number): Promise<{ updated: boolean; status: string | null; autoAssignAt: Date | null }>
{
  const meta = await computeAutoAssignAt(bookingId);
  if (!meta) return { updated: false, status: null, autoAssignAt: null };

  const b = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    select: { interpreterEmpCode: true, bookingStatus: true }
  });
  if (!b) return { updated: false, status: null, autoAssignAt: null };

  let status: string = 'pending';
  if (b.interpreterEmpCode) {
    status = 'done';
  } else if (b.bookingStatus === 'cancel') {
    status = 'skipped';
  } else if (!meta.autoAssignEnabled) {
    status = 'skipped';
  }

  await prisma.bookingPlan.update({
    where: { bookingId },
    data: {
      autoAssignAt: meta.autoAssignAt,
      autoAssignStatus: status,
      autoAssignLockedAt: null,
      autoAssignLockedBy: null
    }
  });

  return { updated: true, status, autoAssignAt: meta.autoAssignAt };
}

