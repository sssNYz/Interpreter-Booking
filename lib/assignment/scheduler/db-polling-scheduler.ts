import prisma, { BookingKind } from "@/prisma/prisma";
import { runAssignment } from "@/lib/assignment/core/run";
import { scheduleAutoAssignForBooking } from "./compute";
// Lightweight timezone handling without external deps.
// We only need next trigger for configured zone; default Asia/Bangkok (UTC+7) has no DST.

type SchedulerHandles = {
  interval?: NodeJS.Timeout;
  dailyTimers: NodeJS.Timeout[];
  instanceId: string;
  running: boolean;
};

const handles: SchedulerHandles = {
  dailyTimers: [],
  instanceId: `${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
  running: false,
};

function parseDailyTimes(str: string | null | undefined): Array<{ hh: number; mm: number }> {
  if (!str) return [];
  return str
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(t => {
      const [hh, mm] = t.split(':');
      const h = Math.max(0, Math.min(23, Number(hh) || 0));
      const m = Math.max(0, Math.min(59, Number(mm) || 0));
      return { hh: h, mm: m };
    });
}

async function loadSchedulerConfig(): Promise<{ pollMinutes: number; dailyTimes: Array<{ hh: number; mm: number }>; timezone: string }>
{
  const cfg = await prisma.autoAssignmentConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
  const pollMinutes = Math.max(1, cfg?.pollIntervalMinutes ?? 180);
  const tz = cfg?.timezone || 'Asia/Bangkok';
  const dailyStr = cfg?.dailyRunTimes || '08:00,17:00';
  const dailyTimes = parseDailyTimes(dailyStr);
  return { pollMinutes, dailyTimes, timezone: tz };
}

function getFixedOffsetMinutes(timezone: string): number {
  const tz = (timezone || '').toLowerCase();
  if (tz === 'asia/bangkok' || tz === 'asia/bangkok (ict)' || tz.includes('bangkok')) return 7 * 60; // ICT UTC+7
  if (tz === 'utc' || tz === 'gmt' || tz.includes('utc')) return 0;
  // Fallback: use current system offset (best effort)
  return -new Date().getTimezoneOffset();
}

function msUntilNextZonedTime(hh: number, mm: number, timezone: string): number {
  const now = new Date();
  const offsetMin = getFixedOffsetMinutes(timezone);
  const zonedNowMs = now.getTime() + offsetMin * 60 * 1000;
  const zonedNow = new Date(zonedNowMs);
  const targetZoned = new Date(zonedNow);
  targetZoned.setHours(hh, mm, 0, 0);
  if (targetZoned.getTime() <= zonedNow.getTime()) {
    targetZoned.setDate(targetZoned.getDate() + 1);
  }
  const targetUtcMs = targetZoned.getTime() - offsetMin * 60 * 1000;
  return Math.max(0, targetUtcMs - now.getTime());
}

async function resetStaleLocks(): Promise<number> {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes
  const res = await prisma.bookingPlan.updateMany({
    where: { autoAssignStatus: 'processing', autoAssignLockedAt: { lt: cutoff }, bookingKind: 'INTERPRETER' as any },
    data: { autoAssignStatus: 'pending', autoAssignLockedAt: null, autoAssignLockedBy: null }
  });
  return res.count;
}

async function findDueBookings(limit = 50): Promise<Array<{ bookingId: number }>> {
  const now = new Date();
  const rows = await prisma.bookingPlan.findMany({
    where: {
      autoAssignStatus: 'pending',
      autoAssignAt: { lte: now },
      bookingStatus: 'waiting',
      interpreterEmpCode: null,
      bookingKind: 'INTERPRETER' as any
    },
    select: { bookingId: true },
    orderBy: { autoAssignAt: 'asc' },
    take: limit
  });
  return rows;
}

async function claimBooking(bookingId: number): Promise<boolean> {
  try {
    // Use raw SQL for conditional update claim
    const result = await prisma.$executeRawUnsafe(
      `UPDATE BOOKING_PLAN
       SET AUTO_ASSIGN_STATUS='processing', AUTO_ASSIGN_LOCKED_AT=NOW(), AUTO_ASSIGN_LOCKED_BY=?
       WHERE BOOKING_ID=? AND AUTO_ASSIGN_STATUS='pending' AND AUTO_ASSIGN_LOCKED_AT IS NULL`,
      handles.instanceId,
      bookingId
    );
    return (result as unknown as number) === 1;
  } catch (e) {
    return false;
  }
}

async function releaseBooking(bookingId: number, nextStatus: 'pending' | 'done' | 'skipped') {
  await prisma.bookingPlan.update({
    where: { bookingId },
    data: {
      autoAssignStatus: nextStatus,
      autoAssignLockedAt: null,
      autoAssignLockedBy: null,
      autoAssignAttempts: { increment: nextStatus === 'pending' ? 1 : 0 }
    }
  });
}

export async function runSchedulerPass(reason: 'interval'|'daily'|'manual' = 'manual') {
  if (!handles.running) return;
  try {
    const stale = await resetStaleLocks();
    if (stale > 0) console.log(`🔄 Scheduler: reset ${stale} stale locks`);

    const due = await findDueBookings(50);
    if (due.length === 0) {
      console.log(`⏱️ Scheduler(${reason}): no due bookings`);
      return;
    }
    console.log(`🚀 Scheduler(${reason}): processing ${due.length} bookings`);

    for (const row of due) {
      const ok = await claimBooking(row.bookingId);
      if (!ok) continue; // claimed by another instance

      try {
        // Ensure scheduling fields exist (compute if missing)
        await scheduleAutoAssignForBooking(row.bookingId);

        const res = await runAssignment(row.bookingId);
        if (res.status === 'assigned') {
          await releaseBooking(row.bookingId, 'done');
        } else {
          // Keep pending for retry/backoff
          await releaseBooking(row.bookingId, 'pending');
        }
      } catch (error) {
        console.error(`❌ Scheduler: error processing booking ${row.bookingId}`, error);
        await releaseBooking(row.bookingId, 'pending');
      }
    }
  } catch (error) {
    console.error('❌ Scheduler pass failed:', error);
  }
}

export async function startScheduler() {
  if (handles.running) return;
  handles.running = true;
  const cfg = await loadSchedulerConfig();
  console.log(`🗓️  Starting DB scheduler: every ${cfg.pollMinutes}m, daily at ${cfg.dailyTimes.map(t => `${t.hh}:${t.mm.toString().padStart(2,'0')}`).join(', ') || '—'} (${cfg.timezone})`);

  // Interval poll
  handles.interval = setInterval(() => runSchedulerPass('interval'), cfg.pollMinutes * 60 * 1000);

  // Daily times
  for (const t of cfg.dailyTimes) {
    const ms = msUntilNextZonedTime(t.hh, t.mm, cfg.timezone);
    const timer = setTimeout(function fire() {
      if (!handles.running) return;
      // re-schedule next day first to avoid drift if pass takes long
      const nextMs = msUntilNextZonedTime(t.hh, t.mm, cfg.timezone);
      setTimeout(fire, nextMs);
      void runSchedulerPass('daily');
    }, ms);
    handles.dailyTimers.push(timer);
  }
}

export function stopScheduler() {
  handles.running = false;
  if (handles.interval) clearInterval(handles.interval);
  for (const timer of handles.dailyTimers) clearTimeout(timer);
  handles.dailyTimers = [];
}

export function getSchedulerStatus() {
  return {
    running: handles.running,
    instanceId: handles.instanceId
  };
}
