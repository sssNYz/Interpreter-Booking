// NOTE: Protected by middleware via cookie session
// app/api/booking/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma, {
  OwnerGroup,
  BookingStatus,
  MeetingType,
  RecurrenceType,
  EndType,
  WeekOrder,
} from "@/prisma/prisma";
import type { CreateBookingRequest } from "@/types/booking-requests";
import type { ApiResponse } from "@/types/api";
import type { RunResult } from "@/types/assignment";
import { getEffectivePolicyForEnvironment } from "@/lib/assignment/config/env-policy";
import { server as featureFlags } from "@/lib/feature-flags";
import { centerPart } from "@/utils/users";

// Interface moved to '@/types/booking-requests'

// Global capacity across all rooms
//const GLOBAL_SLOT_CAPACITY = 2;

// Standard API response shape moved to '@/types/api'

// Date validation helper: strict "YYYY-MM-DD HH:mm:ss"
const isValidDateString = (s: string): boolean => {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s);
};

const getInterpreterCount = async (): Promise<number> => {
  try {
    const count = await prisma.employee.count({
      where: {
        userRoles: {
          some: {
            roleCode: "INTERPRETER",
          },
        },
      },
    });
    return Math.max(1, count); // At least 1 interpreter
  } catch (error) {
    console.error("Failed to get interpreter count:", error);
    return 2; // Fallback to 2
  }
};

// Validation function
const validateBookingData = (
  data: CreateBookingRequest
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Required field validations
  if (
    !data.ownerEmpCode ||
    typeof data.ownerEmpCode !== "string" ||
    data.ownerEmpCode.trim().length === 0
  ) {
    errors.push("ownerEmpCode is required and must be a non-empty string");
  } else if (data.ownerEmpCode.length > 64) {
    errors.push("ownerEmpCode must be 64 characters or less");
  }

  if (
    !data.ownerGroup ||
    !Object.values(OwnerGroup).includes(data.ownerGroup)
  ) {
    errors.push(
      `ownerGroup is required and must be one of: ${Object.values(
        OwnerGroup
      ).join(", ")}`
    );
  }

  if (
    !data.meetingRoom ||
    typeof data.meetingRoom !== "string" ||
    data.meetingRoom.trim().length === 0
  ) {
    errors.push("meetingRoom is required and must be a non-empty string");
  } else if (data.meetingRoom.length > 50) {
    errors.push("meetingRoom must be 50 characters or less");
  }

  // Required meeting type validation
  if (
    !data.meetingType ||
    !Object.values(MeetingType).includes(data.meetingType)
  ) {
    errors.push(
      `meetingType is required and must be one of: ${Object.values(
        MeetingType
      ).join(", ")}`
    );
  }

  // Enhanced meeting type specific validations
  if (data.meetingType) {
    // DR Type validations
    if (data.meetingType === "DR") {
      // DR type is required for DR meetings
      // Accept both Prisma enum values and database enum values for raw SQL compatibility
      const validDrTypes = [
        "DR_PR",
        "DR_k",
        "DR_II",
        "DR_I",
        "Other",
        "DR-PR",
        "DR-k",
        "DR-II",
        "DR-I",
      ];
      if (!data.drType || !validDrTypes.includes(data.drType)) {
        errors.push(
          "drType is required and must be a valid DRType when meetingType is DR"
        );
      } else {
        // If DR type is "Other", otherType is required and scope must be correct
        if (data.drType === "Other") {
          if (!data.otherType || !data.otherType.trim()) {
            errors.push(
              "otherType is required when meetingType is DR and drType is Other"
            );
          } else if (data.otherType.length > 255) {
            errors.push("otherType must be 255 characters or less");
          }
          // Validate otherTypeScope for DR meetings
          if (data.otherTypeScope && data.otherTypeScope !== "dr_type") {
            errors.push(
              "otherTypeScope must be 'dr_type' when meetingType is DR and drType is Other"
            );
          }
        }
        // For non-Other DR types, otherType should not be provided
        else if (data.otherType && data.otherType.trim()) {
          errors.push(
            "otherType should not be provided when drType is not 'Other'"
          );
        }
        // For non-Other DR types, otherTypeScope should not be provided
        if (data.drType !== "Other" && data.otherTypeScope) {
          errors.push(
            "otherTypeScope should not be provided when drType is not 'Other'"
          );
        }
      }
    }

    // Other meeting type validations
    else if (data.meetingType === "Other") {
      // otherType is required for Other meetings
      if (!data.otherType || !data.otherType.trim()) {
        errors.push("otherType is required when meetingType is Other");
      } else if (data.otherType.length > 255) {
        errors.push("otherType must be 255 characters or less");
      }
      // Validate otherTypeScope for Other meetings
      if (data.otherTypeScope && data.otherTypeScope !== "meeting_type") {
        errors.push(
          "otherTypeScope must be 'meeting_type' when meetingType is Other"
        );
      }
      // For Other meetings, drType should not be provided
      if (data.drType) {
        errors.push("drType should not be provided when meetingType is Other");
      }
    }

    // For non-DR and non-Other meeting types (VIP, Weekly, General, Urgent, President)
    else {
      // These meeting types should not have drType, otherType, or otherTypeScope
      if (data.drType) {
        errors.push(
          `drType should not be provided when meetingType is ${data.meetingType}`
        );
      }
      if (data.otherType && data.otherType.trim()) {
        errors.push(
          `otherType should not be provided when meetingType is ${data.meetingType}`
        );
      }
      if (data.otherTypeScope) {
        errors.push(
          `otherTypeScope should not be provided when meetingType is ${data.meetingType}`
        );
      }
    }
  }

  if (!data.timeStart || !isValidDateString(data.timeStart)) {
    errors.push("timeStart is required and must be 'YYYY-MM-DD HH:mm:ss'");
  }

  if (!data.timeEnd || !isValidDateString(data.timeEnd)) {
    errors.push("timeEnd is required and must be 'YYYY-MM-DD HH:mm:ss'");
  }

  // Validate time range
  if (
    data.timeStart &&
    data.timeEnd &&
    isValidDateString(data.timeStart) &&
    isValidDateString(data.timeEnd)
  ) {
    if (data.timeStart >= data.timeEnd) {
      errors.push("timeEnd must be after timeStart");
    }
  }

  if (data.force !== undefined && typeof data.force !== "boolean") {
    errors.push("force must be a boolean");
  }

  if (
    data.interpreterEmpCode !== undefined &&
    data.interpreterEmpCode !== null
  ) {
    if (
      typeof data.interpreterEmpCode !== "string" ||
      data.interpreterEmpCode.trim().length === 0
    ) {
      errors.push(
        "interpreterEmpCode must be a non-empty string when provided"
      );
    } else if (data.interpreterEmpCode.length > 64) {
      errors.push("interpreterEmpCode must be 64 characters or less");
    }
  }

  // Language validation
  if (data.languageCode !== undefined && data.languageCode !== null) {
    if (
      typeof data.languageCode !== "string" ||
      data.languageCode.trim().length === 0
    ) {
      errors.push("languageCode must be a non-empty string when provided");
    } else if (data.languageCode.length > 16) {
      errors.push("languageCode must be 16 characters or less");
    }
  }

  // Chairman email validation (required for DR meetings)
  if (data.meetingType === "DR") {
    if (
      !data.chairmanEmail ||
      typeof data.chairmanEmail !== "string" ||
      data.chairmanEmail.trim().length === 0
    ) {
      errors.push("chairmanEmail is required for DR meetings");
    } else if (data.chairmanEmail.length > 255) {
      errors.push("chairmanEmail must be 255 characters or less");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.chairmanEmail)) {
      errors.push("chairmanEmail must be a valid email address");
    }
  } else if (data.chairmanEmail) {
    errors.push("chairmanEmail should only be provided for DR meetings");
  }

  // Selected interpreter validation (required for President meetings)
  if (data.meetingType === "President") {
    if (
      !data.selectedInterpreterEmpCode ||
      typeof data.selectedInterpreterEmpCode !== "string" ||
      data.selectedInterpreterEmpCode.trim().length === 0
    ) {
      errors.push(
        "selectedInterpreterEmpCode is required for President meetings"
      );
    } else if (data.selectedInterpreterEmpCode.length > 64) {
      errors.push("selectedInterpreterEmpCode must be 64 characters or less");
    }
  } else if (data.selectedInterpreterEmpCode) {
    errors.push(
      "selectedInterpreterEmpCode should only be provided for President meetings"
    );
  }

  if (
    data.bookingStatus &&
    !Object.values(BookingStatus).includes(data.bookingStatus)
  ) {
    errors.push(
      `bookingStatus must be one of: ${Object.values(BookingStatus).join(", ")}`
    );
  }

  if (
    data.inviteEmails &&
    (!Array.isArray(data.inviteEmails) ||
      !data.inviteEmails.every((email: string) => typeof email === "string"))
  ) {
    errors.push("inviteEmails must be an array of strings");
  }

  // Recurrence validations (optional)
  if (data.isRecurring) {
    if (
      data.recurrenceType &&
      !Object.values(RecurrenceType).includes(data.recurrenceType)
    ) {
      errors.push(
        `recurrenceType must be one of: ${Object.values(RecurrenceType).join(
          ", "
        )}`
      );
    }
    if (
      data.recurrenceInterval !== undefined &&
      data.recurrenceInterval !== null
    ) {
      if (
        typeof data.recurrenceInterval !== "number" ||
        data.recurrenceInterval < 1
      ) {
        errors.push(
          "recurrenceInterval must be a positive number when provided"
        );
      }
    }
    if (
      data.recurrenceEndType &&
      !Object.values(EndType).includes(data.recurrenceEndType)
    ) {
      errors.push(
        `recurrenceEndType must be one of: ${Object.values(EndType).join(", ")}`
      );
    }
    if (data.recurrenceEndDate) {
      if (!isValidDateString(data.recurrenceEndDate)) {
        errors.push("recurrenceEndDate must be 'YYYY-MM-DD HH:mm:ss'");
      }
    }
    if (
      data.recurrenceEndOccurrences !== undefined &&
      data.recurrenceEndOccurrences !== null
    ) {
      if (
        typeof data.recurrenceEndOccurrences !== "number" ||
        data.recurrenceEndOccurrences < 1
      ) {
        errors.push(
          "recurrenceEndOccurrences must be a positive number when provided"
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// No conversion; use provided strings directly
const parseBookingDates = (timeStart: string, timeEnd: string) => {
  return { timeStart, timeEnd };
};

// Helpers for recurrence date generation
const toDate = (ymdHms: string): Date => {
  // Interpret as local time (no timezone conversion)
  const [d, t] = ymdHms.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm, ss] = t.split(":").map(Number);
  return new Date(y, m - 1, day, hh, mm, ss, 0);
};

const formatYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, days: number): Date => {
  const nd = new Date(d.getTime());
  nd.setDate(nd.getDate() + days);
  return nd;
};

const addMonths = (d: Date, months: number): Date => {
  const nd = new Date(d.getTime());
  const targetMonth = nd.getMonth() + months;
  nd.setMonth(targetMonth);
  return nd;
};

const weekdayToIndex: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const getNthWeekdayOfMonth = (
  year: number,
  monthIndex: number,
  weekdayIndex: number,
  order: WeekOrder
): Date => {
  // monthIndex 0-11
  const firstOfMonth = new Date(year, monthIndex, 1);
  const firstWeekdayIndex = firstOfMonth.getDay();
  let dayOfMonth = 1 + ((7 + weekdayIndex - firstWeekdayIndex) % 7);
  const orderToOffset: Record<WeekOrder, number> = {
    first: 0,
    second: 7,
    third: 14,
    fourth: 21,
    last: -1,
  } as const;
  const offset = orderToOffset[order];
  if (order !== "last") {
    dayOfMonth += offset;
    return new Date(year, monthIndex, dayOfMonth);
  }
  // last: find last occurrence
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const lastWeekday = lastOfMonth.getDay();
  const diff = (7 + lastWeekday - weekdayIndex) % 7;
  return new Date(year, monthIndex + 1, lastOfMonth.getDate() - diff);
};

type Occurrence = { timeStart: string; timeEnd: string };

const generateOccurrences = (
  baseStart: string,
  baseEnd: string,
  settings: {
    recurrenceType?: RecurrenceType | null;
    recurrenceInterval?: number | null;
    recurrenceEndType?: EndType | null;
    recurrenceEndDate?: string | null;
    recurrenceEndOccurrences?: number | null;
    recurrenceWeekdays?: string | null; // csv
    recurrenceMonthday?: number | null;
    recurrenceWeekOrder?: WeekOrder | null;
    skipWeekends?: boolean | null;
  }
): Occurrence[] => {
  const occurrences: Occurrence[] = [];
  const startDate = toDate(baseStart);
  // const endDate = toDate(baseEnd);
  // const durationMs = endDate.getTime() - startDate.getTime();

  // Determine limit
  const maxTotal = 104; // hard safety cap
  // Do not cap by occurrences here. We'll generate a long-enough series
  // and let the insertion phase stop after successfully inserting the
  // requested number of children. This avoids shortfalls when some
  // children are skipped due to conflicts.
  // (no per-generator cap)

  // Treat end date as an inclusive "Until" day (compare date-only)
  const untilYmd: string | null =
    settings.recurrenceEndType === "on_date" && settings.recurrenceEndDate
      ? String(settings.recurrenceEndDate).split(" ")[0]
      : null;

  const interval = Math.max(1, settings.recurrenceInterval || 1);

  const pushIfWithin = (candidateStart: Date) => {
    if (occurrences.length >= maxTotal) return false;
    if (untilYmd) {
      const candidateYmd = formatYmd(candidateStart);
      if (candidateYmd > untilYmd) return false;
    }
    // Do not enforce remainingChildren here; insertion phase will do it
    const ymd = formatYmd(candidateStart);
    const hhmmss = baseStart.split(" ")[1];
    const hhmmssEnd = baseEnd.split(" ")[1];
    const s = `${ymd} ${hhmmss}`;
    const e = `${ymd} ${hhmmssEnd}`;
    occurrences.push({ timeStart: s, timeEnd: e });
    return true;
  };

  const type = settings.recurrenceType || "weekly";
  if (type === "daily") {
    if (settings.recurrenceEndType === "after_occurrences") {
      // Iterate day by day and only count/push Mon–Fri until desired occurrences reached
      let dayOffset = 1;
      let eligibleWorkdayCount = 0;
      while (occurrences.length < maxTotal) {
        const candidate = addDays(startDate, dayOffset);
        dayOffset += 1;
        const weekday = candidate.getDay(); // 0=Sun, 6=Sat
        const isWeekend = weekday === 0 || weekday === 6;
        if (isWeekend) continue;
        eligibleWorkdayCount += 1;
        // Respect interval by only pushing every Nth workday
        if (eligibleWorkdayCount % interval !== 0) continue;
        if (!pushIfWithin(candidate)) break;
      }
    } else {
      for (let i = 1; i < maxTotal; i++) {
        const candidate = addDays(startDate, i * interval);
        if (settings.skipWeekends) {
          const wd = candidate.getDay();
          if (wd === 0 || wd === 6) continue;
        }
        if (!pushIfWithin(candidate)) break;
      }
    }
  } else if (type === "weekly" || type === "biweekly" || type === "custom") {
    const actualInterval = type === "biweekly" ? 2 : interval;
    const weekdaysCsv = (settings.recurrenceWeekdays || "").trim();
    const weekdays: number[] = weekdaysCsv
      ? weekdaysCsv
          .split(",")
          .map((d) => weekdayToIndex[d.trim()])
          .filter((n) => Number.isFinite(n))
      : [startDate.getDay()];

    // generate week by week
    // Start from the week of the original start date
    let weekStart = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );
    // Align to Sunday of that week
    weekStart = addDays(weekStart, -weekStart.getDay());
    for (let w = 0; w < maxTotal; w++) {
      if (w >= 1) {
        weekStart = addDays(weekStart, 7 * actualInterval);
      }
      for (const wd of weekdays) {
        const candidate = addDays(weekStart, wd);
        if (settings.skipWeekends && (wd === 0 || wd === 6)) {
          continue;
        }
        // skip the original date itself; only children
        if (candidate.getTime() === startDate.getTime()) continue;
        if (!pushIfWithin(candidate)) {
          return occurrences;
        }
      }
    }
  } else if (type === "monthly") {
    const hasNth = Boolean(
      settings.recurrenceWeekOrder && settings.recurrenceWeekdays
    );
    const monthday = settings.recurrenceMonthday || startDate.getDate();
    const weekdayCsv = (settings.recurrenceWeekdays || "").trim();
    const weekdayIndex = weekdayCsv
      ? weekdayToIndex[weekdayCsv.split(",")[0].trim()]
      : startDate.getDay();
    for (let m = 1; m < maxTotal; m++) {
      const base = addMonths(startDate, m * interval);
      let candidate: Date;
      if (hasNth && settings.recurrenceWeekOrder) {
        candidate = getNthWeekdayOfMonth(
          base.getFullYear(),
          base.getMonth(),
          weekdayIndex,
          settings.recurrenceWeekOrder
        );
      } else {
        const yr = base.getFullYear();
        const mo = base.getMonth();
        const lastDay = new Date(yr, mo + 1, 0).getDate();
        if (monthday > lastDay) {
          // target day (e.g., 29/30/31) does not exist this month; skip
          continue;
        }
        candidate = new Date(yr, mo, monthday);
      }
      if (settings.skipWeekends) {
        const wd = candidate.getDay();
        if (wd === 0 || wd === 6) {
          // skip weekend occurrences when requested
          continue;
        }
      }
      if (!pushIfWithin(candidate)) break;
    }
  }
  return occurrences;
};

export async function POST(request: NextRequest) {
  try {
    const body: CreateBookingRequest = await request.json();
    const validation = validateBookingData(body);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Ensure owner employee exists to satisfy FK constraint before raw insert
    const ownerEmpCode = body.ownerEmpCode?.trim();
    if (!ownerEmpCode) {
      return NextResponse.json(
        {
          success: false,
          error: "ownerEmpCode is required",
          code: "OWNER_EMP_CODE_REQUIRED",
        },
        { status: 400 }
      );
    }

    const ownerExists = await prisma.employee.findUnique({
      where: { empCode: ownerEmpCode },
    });
    if (!ownerExists) {
      return NextResponse.json(
        {
          success: false,
          error: `Owner employee not found: ${ownerEmpCode}`,
          code: "OWNER_NOT_FOUND",
        },
        { status: 400 }
      );
    }

    const { timeStart, timeEnd } = parseBookingDates(
      body.timeStart,
      body.timeEnd
    );
    // Enforce: only allow current month and next month (by month, not by day)
    const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const now = new Date();
    const envLimitRaw = process.env.FORWARD_MONTH_LIMIT;
    let forwardMonthLimit = Number.parseInt(String(envLimitRaw ?? ''), 10);
    if (!Number.isFinite(forwardMonthLimit) || forwardMonthLimit < 0) forwardMonthLimit = 1;
    const startDate = toDate(timeStart);
    const diff = monthIndex(startDate) - monthIndex(now);
    if (!(diff >= 0 && diff <= forwardMonthLimit)) {
      console.warn("DATE_OUT_OF_RANGE", { timeStart, emp: body.ownerEmpCode, limit: forwardMonthLimit });
      return NextResponse.json(
        {
          success: false,
          error: "Date out of allowed range",
          message: `You can book only current + ${forwardMonthLimit} month(s)`,
          code: "DATE_OUT_OF_RANGE",
        },
        { status: 400 }
      );
    }

    // If recurring, ensure end and all occurrences are within end of next month
    if (body.isRecurring) {
      const endOfNextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + forwardMonthLimit + 1,
        0,
        23,
        59,
        59,
        999
      );
      if (body.recurrenceEndType === "on_date" && body.recurrenceEndDate) {
        const recEnd = toDate(body.recurrenceEndDate);
        if (recEnd > endOfNextMonth) {
          console.warn("RECURRENCE_END_OUT_OF_RANGE", { recEnd: body.recurrenceEndDate, limit: endOfNextMonth.toISOString() });
          return NextResponse.json(
            {
              success: false,
              error: "Recurrence end out of range",
              message: `Repeat end date must be within current + ${forwardMonthLimit} month(s)`,
              code: "RECURRENCE_END_OUT_OF_RANGE",
            },
            { status: 400 }
          );
        }
      }

      // Generate occurrences to validate they stay within the window
      const occ = generateOccurrences(timeStart, timeEnd, {
        recurrenceType: body.recurrenceType,
        recurrenceInterval: body.recurrenceInterval,
        recurrenceEndType: body.recurrenceEndType,
        recurrenceEndDate: body.recurrenceEndDate ?? null,
        recurrenceEndOccurrences: body.recurrenceEndOccurrences ?? null,
        recurrenceWeekdays: body.recurrenceWeekdays ?? null,
        recurrenceMonthday: body.recurrenceMonthday ?? null,
        recurrenceWeekOrder: body.recurrenceWeekOrder ?? null,
        skipWeekends: body.skipWeekends ?? null,
      });
      // Consider only the first N children when endType is after_occurrences
      let occToCheck = occ;
      if (
        body.recurrenceEndType === "after_occurrences" &&
        typeof body.recurrenceEndOccurrences === "number"
      ) {
        const targetChildren = Math.max(0, body.recurrenceEndOccurrences - 1);
        occToCheck = occ.slice(0, targetChildren);
      }
      const offending = occToCheck.find(({ timeStart: ts }) => toDate(ts) > endOfNextMonth);
      if (offending) {
        console.warn("RECURRENCE_OUT_OF_RANGE", { firstOffending: offending.timeStart, limit: endOfNextMonth.toISOString() });
        return NextResponse.json(
          {
            success: false,
            error: "Recurrence out of range",
            message: `Repeat dates must be within current + ${forwardMonthLimit} month(s)`,
            code: "RECURRENCE_OUT_OF_RANGE",
          },
          { status: 400 }
        );
      }
    }
    const interpreterCount = await getInterpreterCount();
    // normalize chairman email once for consistent checks and storage
    const normalizedChairmanEmail = body.chairmanEmail
      ? body.chairmanEmail.trim().toLowerCase()
      : null;

    // Use an interactive transaction to keep operations atomic (insert + related records)
    const result = await prisma.$transaction(
      async (tx) => {
        // Acquire a global advisory lock to serialize overlap checks + insert
        const lockKey = "booking_global_capacity";
        const lockRes = await tx.$queryRaw<Array<{ locked: number | bigint }>>`
          SELECT GET_LOCK(${lockKey}, 5) AS locked
        `;
        const lockedVal = lockRes?.[0]?.locked;
        const lockOk = lockedVal != null ? Number(lockedVal) === 1 : false;
        if (!lockOk) {
          throw new Error("Failed to acquire global booking lock");
        }
        try {
          // helper to perform capacity check
          const capacityOk = async (ts: string, te: string) => {
            const capCounts = await tx.$queryRaw<
              Array<{ cnt: number | bigint }>
            >`
              SELECT COUNT(*) AS cnt
              FROM BOOKING_PLAN
              WHERE BOOKING_STATUS <> 'cancel'
              AND (TIME_START < ${te} AND TIME_END > ${ts})
              FOR UPDATE
            `;
            const capCntVal = capCounts?.[0]?.cnt;
            const totalOverlap = capCntVal != null ? Number(capCntVal) : 0;
            return totalOverlap < interpreterCount;
          };

          // 1) Global capacity check (NOT by room) for parent
          const capCounts = await tx.$queryRaw<Array<{ cnt: number | bigint }>>`
            SELECT COUNT(*) AS cnt
            FROM BOOKING_PLAN
            WHERE BOOKING_STATUS <> 'cancel'
            AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
            FOR UPDATE
          `;
          const capCntVal = capCounts?.[0]?.cnt;
          const totalOverlap = capCntVal != null ? Number(capCntVal) : 0;
          if (totalOverlap >= interpreterCount) {
            return {
              success: false as const,
              status: 409,
              body: {
                success: false,
                error: "Time slot full",
                message: "The selected time slot has reached its capacity",
                code: "CAPACITY_FULL",
                data: { totalOverlap, capacity: interpreterCount },
              },
            };
          }

          // 2) Same-room overlap: HARD BLOCK with detailed logging
          const sameRoomCounts = await tx.$queryRaw<
            Array<{ cnt: number | bigint }>
          >`
            SELECT COUNT(*) AS cnt
            FROM BOOKING_PLAN
            WHERE MEETING_ROOM = ${body.meetingRoom}
            AND BOOKING_STATUS <> 'cancel'
            AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
          `;
          const sameRoomCntVal = sameRoomCounts?.[0]?.cnt;
          const sameRoomOverlap =
            sameRoomCntVal != null ? Number(sameRoomCntVal) : 0;
          if (sameRoomOverlap > 0) {
            // Load conflict details for logs and response
            const conflictRows = await tx.$queryRaw<
              Array<{
                bookingId: number | bigint;
                timeStart: Date;
                timeEnd: Date;
                bookingStatus: string;
              }>
            >`
              SELECT 
                BOOKING_ID as bookingId,
                TIME_START as timeStart,
                TIME_END as timeEnd,
                BOOKING_STATUS as bookingStatus
              FROM BOOKING_PLAN
              WHERE MEETING_ROOM = ${body.meetingRoom}
                AND BOOKING_STATUS <> 'cancel'
                AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
              ORDER BY TIME_START
            `;

            // Log clear details to help verify if it's a real conflict
            console.log("ROOM_CONFLICT", {
              meetingRoom: body.meetingRoom?.toString().trim(),
              requested: { timeStart, timeEnd },
              conflicts: conflictRows.map((r) => ({
                bookingId: Number(r.bookingId),
                timeStart: r.timeStart,
                timeEnd: r.timeEnd,
                bookingStatus: r.bookingStatus,
              })),
            });

            return {
              success: false as const,
              status: 409,
              body: {
                success: false,
                error: "Room conflict",
                message: `Room '${body.meetingRoom?.toString().trim()}' is already booked during this time.`,
                code: "ROOM_CONFLICT",
                data: {
                  meetingRoom: body.meetingRoom?.toString().trim(),
                  overlapCount: sameRoomOverlap,
                  conflicts: conflictRows.map((r) => ({
                    bookingId: Number(r.bookingId),
                    timeStart: r.timeStart,
                    timeEnd: r.timeEnd,
                    bookingStatus: r.bookingStatus,
                  })),
                },
              },
            };
          }

          // 2.5) Chairman overlap check for parent (DR only)
          if (body.meetingType === "DR" && normalizedChairmanEmail) {
            const chCounts = await tx.$queryRaw<
              Array<{ cnt: number | bigint }>
            >`
              SELECT COUNT(*) AS cnt
              FROM BOOKING_PLAN
              WHERE CHAIRMAN_EMAIL = ${normalizedChairmanEmail}
              AND BOOKING_STATUS <> 'cancel'
              AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
              FOR UPDATE
            `;
            const chCntVal = chCounts?.[0]?.cnt;
            const chCnt = chCntVal != null ? Number(chCntVal) : 0;
            if (chCnt > 0) {
              // Fetch a sample conflicting row for details
              const conflictRow = await tx.$queryRaw<
                Array<{
                  bookingId: number | bigint;
                  timeStart: Date;
                  timeEnd: Date;
                  meetingRoom: string;
                  ownerEmpCode: string | null;
                }>
              >`
                SELECT 
                  BOOKING_ID as bookingId,
                  TIME_START as timeStart,
                  TIME_END as timeEnd,
                  MEETING_ROOM as meetingRoom,
                  OWNER_EMP_CODE as ownerEmpCode
                FROM BOOKING_PLAN
                WHERE CHAIRMAN_EMAIL = ${normalizedChairmanEmail}
                  AND BOOKING_STATUS <> 'cancel'
                  AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
                LIMIT 1
                FOR UPDATE
              `;
              const row = conflictRow?.[0];
              return {
                success: false as const,
                status: 409,
                body: {
                  success: false,
                  error: "Chairman conflict detected",
                  message: `Chairman ${normalizedChairmanEmail} is already booked for this time`,
                  code: "CHAIRMAN_CONFLICT",
                  conflictDetails: row
                    ? {
                        bookingId:
                          row.bookingId != null ? Number(row.bookingId) : null,
                        timeStart: row.timeStart,
                        timeEnd: row.timeEnd,
                        meetingRoom: row.meetingRoom,
                        ownerEmpCode: row.ownerEmpCode,
                      }
                    : undefined,
                },
              };
            }
          }

          // 2.6) Final safety: interpreter overlap (President only)
          if (
            body.meetingType === "President" &&
            body.selectedInterpreterEmpCode
          ) {
            const sel = body.selectedInterpreterEmpCode.trim();
            const busyCounts = await tx.$queryRaw<
              Array<{ cnt: number | bigint }>
            >`
            SELECT COUNT(*) AS cnt
            FROM BOOKING_PLAN
            WHERE INTERPRETER_EMP_CODE = ${sel}
              AND BOOKING_STATUS <> 'cancel'
              AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
            FOR UPDATE
          `;
            const busyCnt =
              busyCounts?.[0]?.cnt != null ? Number(busyCounts[0].cnt) : 0;
            if (busyCnt > 0) {
              const conflictRow = await tx.$queryRaw<
                Array<{
                  bookingId: number | bigint;
                  timeStart: Date;
                  timeEnd: Date;
                  meetingRoom: string;
                }>
              >`
              SELECT BOOKING_ID as bookingId, TIME_START as timeStart, TIME_END as timeEnd, MEETING_ROOM as meetingRoom
              FROM BOOKING_PLAN
              WHERE INTERPRETER_EMP_CODE = ${sel}
                AND BOOKING_STATUS <> 'cancel'
                AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
              LIMIT 1
              FOR UPDATE
            `;
              const c = conflictRow?.[0];
              return {
                success: false as const,
                status: 409,
                body: {
                  success: false,
                  error: "Interpreter conflict",
                  message: `Interpreter ${sel} is already booked in this time range`,
                  code: "INTERPRETER_CONFLICT",
                  conflictDetails: c
                    ? {
                        bookingId:
                          c.bookingId != null ? Number(c.bookingId) : null,
                        timeStart: c.timeStart,
                        timeEnd: c.timeEnd,
                        meetingRoom: c.meetingRoom,
                      }
                    : undefined,
                },
              };
            }
          }

          // 3) Insert parent booking (capacity still enforced by the global lock + check)
          const isPresident =
            body.meetingType === "President" && body.selectedInterpreterEmpCode;
          // Determine environment for policy gate
          let envId: number | null = null;
          const owner = await tx.employee.findUnique({
            where: { empCode: ownerEmpCode },
            select: { deptPath: true },
          });
          const center = centerPart(owner?.deptPath ?? null);
          if (center) {
            const envCenter = await tx.environmentCenter.findUnique({
              where: { center },
              select: { environmentId: true },
            });
            envId = envCenter?.environmentId ?? null;
          }
          let allowAutoApprove = true;
          if (envId != null) {
            const eff = await getEffectivePolicyForEnvironment(envId);
            allowAutoApprove = !!eff.autoAssignEnabled;
          }
          await tx.$executeRaw`
            INSERT INTO BOOKING_PLAN (
              \`OWNER_GROUP\`, \`MEETING_ROOM\`, \`MEETING_DETAIL\`, \`TIME_START\`, \`TIME_END\`, \`BOOKING_STATUS\`, \`created_at\`, \`updated_at\`,
              \`DR_TYPE\`, \`OTHER_TYPE\`, \`OTHER_TYPE_SCOPE\`, \`APPLICABLE_MODEL\`, \`INTERPRETER_EMP_CODE\`, \`IS_RECURRING\`, \`MEETING_TYPE\`, \`OWNER_EMP_CODE\`,
              \`RECURRENCE_END_DATE\`, \`RECURRENCE_END_OCCURRENCES\`, \`RECURRENCE_END_TYPE\`, \`RECURRENCE_INTERVAL\`, \`RECURRENCE_MONTHDAY\`, \`RECURRENCE_TYPE\`, \`RECURRENCE_WEEKDAYS\`, \`RECURRENCE_WEEK_ORDER\`,
              \`LANGUAGE_CODE\`, \`CHAIRMAN_EMAIL\`, \`SELECTED_INTERPRETER_EMP_CODE\`,
              \`FORWARD_ACTIONS\`
            ) VALUES (
              ${body.ownerGroup}, ${body.meetingRoom.trim()}, ${
            body.meetingDetail ?? null
          }, ${timeStart}, ${timeEnd}, ${
            isPresident && allowAutoApprove
              ? "approve"
              : body.bookingStatus || BookingStatus.waiting
          }, NOW(), NOW(),
              ${body.drType ?? null}, ${body.otherType ?? null}, ${
            body.otherTypeScope ?? null
          }, ${body.applicableModel ?? null}, ${
            isPresident && allowAutoApprove
              ? body.selectedInterpreterEmpCode
              : body.interpreterEmpCode ?? null
          }, ${body.isRecurring ? 1 : 0}, ${
            body.meetingType ?? null
          }, ${ownerEmpCode},
              ${body.recurrenceEndDate ?? null}, ${
            body.recurrenceEndOccurrences ?? null
          }, ${body.recurrenceEndType ?? null}, ${
            body.recurrenceInterval ?? null
          }, ${body.recurrenceMonthday ?? null}, ${
            body.recurrenceType ?? null
          }, ${body.recurrenceWeekdays ?? null}, ${
            body.recurrenceWeekOrder ?? null
          },
              ${body.languageCode ?? null}, ${
            normalizedChairmanEmail ?? null
          }, ${body.selectedInterpreterEmpCode ?? null},
              '[]'
            )
          `;
          const inserted = await tx.$queryRaw<
            Array<{ id: number | bigint }>
          >`SELECT LAST_INSERT_ID() as id`;
          const bookingIdValue = inserted?.[0]?.id;
          const bookingId =
            bookingIdValue != null ? Number(bookingIdValue) : null;

          // Persist invite emails if provided
          if (
            bookingId &&
            Array.isArray(body.inviteEmails) &&
            body.inviteEmails.length > 0
          ) {
            const emailsToInsert = body.inviteEmails
              .filter(
                (email: string) =>
                  typeof email === "string" && email.trim().length > 0
              )
              .map((email: string) => ({ bookingId, email: email.trim() }));
            if (emailsToInsert.length > 0) {
              await tx.inviteEmailList.createMany({
                data: emailsToInsert,
                skipDuplicates: true,
              });
            }
          }

          // 4) If recurring, generate and insert child occurrences
          let childrenInserted = 0;
          if (bookingId && body.isRecurring) {
            const occ = generateOccurrences(timeStart, timeEnd, {
              recurrenceType: body.recurrenceType,
              recurrenceInterval: body.recurrenceInterval,
              recurrenceEndType: body.recurrenceEndType,
              recurrenceEndDate: body.recurrenceEndDate ?? null,
              recurrenceEndOccurrences: body.recurrenceEndOccurrences ?? null,
              recurrenceWeekdays: body.recurrenceWeekdays ?? null,
              recurrenceMonthday: body.recurrenceMonthday ?? null,
              recurrenceWeekOrder: body.recurrenceWeekOrder ?? null,
              skipWeekends: body.skipWeekends ?? null,
            });
            // If user selected after_occurrences, we need to insert exactly that many children
            const targetChildren =
              body.recurrenceEndType === "after_occurrences" &&
              typeof body.recurrenceEndOccurrences === "number"
                ? Math.max(0, body.recurrenceEndOccurrences - 1)
                : Infinity;

            for (const o of occ) {
              if (childrenInserted >= targetChildren) break;
              // capacity check per child
              const capOk = await capacityOk(o.timeStart, o.timeEnd);
              if (!capOk) continue;

              // Chairman conflict check for recurring children (DR only)
              if (body.meetingType === "DR" && normalizedChairmanEmail) {
                const chairmanOverlapChild = await tx.$queryRaw<
                  Array<{ cnt: number | bigint }>
                >`
                  SELECT COUNT(*) AS cnt
                  FROM BOOKING_PLAN
                  WHERE CHAIRMAN_EMAIL = ${normalizedChairmanEmail}
                  AND BOOKING_STATUS <> 'cancel'
                  AND (TIME_START < ${o.timeEnd} AND TIME_END > ${o.timeStart})
                `;
                const cVal = chairmanOverlapChild?.[0]?.cnt;
                const cCount = cVal != null ? Number(cVal) : 0;
                if (cCount > 0) continue; // skip conflicting child occurrence
              }
              // same-room check for each child: ALWAYS skip conflicting child (no force bypass)
              {
                const sameRoomCountsChild = await tx.$queryRaw<
                  Array<{ cnt: number | bigint }>
                >`
                  SELECT COUNT(*) AS cnt
                  FROM BOOKING_PLAN
                  WHERE MEETING_ROOM = ${body.meetingRoom}
                  AND BOOKING_STATUS <> 'cancel'
                  AND (TIME_START < ${o.timeEnd} AND TIME_END > ${o.timeStart})
                `;
                const overlapVal = sameRoomCountsChild?.[0]?.cnt;
                const overlapCount =
                  overlapVal != null ? Number(overlapVal) : 0;
                if (overlapCount > 0) continue; // skip conflicting child
              }

              await tx.$executeRaw`
                INSERT INTO BOOKING_PLAN (
                  \`OWNER_GROUP\`, \`MEETING_ROOM\`, \`MEETING_DETAIL\`, \`TIME_START\`, \`TIME_END\`, \`BOOKING_STATUS\`, \`created_at\`, \`updated_at\`,
                  \`DR_TYPE\`, \`OTHER_TYPE\`, \`OTHER_TYPE_SCOPE\`, \`APPLICABLE_MODEL\`, \`INTERPRETER_EMP_CODE\`, \`IS_RECURRING\`, \`MEETING_TYPE\`, \`OWNER_EMP_CODE\`, \`PARENT_BOOKING_ID\`,
                  \`LANGUAGE_CODE\`, \`CHAIRMAN_EMAIL\`, \`SELECTED_INTERPRETER_EMP_CODE\`,
                  \`FORWARD_ACTIONS\`
                ) VALUES (
                  ${body.ownerGroup}, ${body.meetingRoom.trim()}, ${
                body.meetingDetail ?? null
              }, ${o.timeStart}, ${o.timeEnd}, ${
                body.bookingStatus || BookingStatus.waiting
              }, NOW(), NOW(),
                  ${body.drType ?? null}, ${body.otherType ?? null}, ${
                body.otherTypeScope ?? null
              }, ${body.applicableModel ?? null}, ${
                body.interpreterEmpCode ?? null
              }, ${body.isRecurring ? 1 : 0}, ${
                body.meetingType ?? null
              }, ${body.ownerEmpCode.trim()}, ${bookingId},
                  ${body.languageCode ?? null}, ${
                normalizedChairmanEmail ?? null
              }, ${body.selectedInterpreterEmpCode ?? null},
                  '[]'
                )
              `;
              // copy invite emails if any
              if (
                Array.isArray(body.inviteEmails) &&
                body.inviteEmails.length > 0
              ) {
                const childInserted = await tx.$queryRaw<
                  Array<{ id: number | bigint }>
                >`SELECT LAST_INSERT_ID() as id`;
                const childIdVal = childInserted?.[0]?.id;
                const childId = childIdVal != null ? Number(childIdVal) : null;
                if (childId) {
                  const emailsToInsertChild = body.inviteEmails
                    .filter(
                      (email: string) =>
                        typeof email === "string" && email.trim().length > 0
                    )
                    .map((email: string) => ({
                      bookingId: childId,
                      email: email.trim(),
                    }));
                  await tx.inviteEmailList.createMany({
                    data: emailsToInsertChild,
                    skipDuplicates: true,
                  });
                }
              }
              childrenInserted++;
            }
          }

          return {
            success: true as const,
            status: 201,
            body: {
              success: true,
              message: "Booking created successfully",
              data: {
                bookingId,
                meetingRoom: body.meetingRoom.trim(),
                timeStart,
                timeEnd,
                bookingStatus:
                  isPresident && allowAutoApprove
                    ? "approve"
                    : body.bookingStatus || BookingStatus.waiting,
                inviteEmailsSaved: Array.isArray(body.inviteEmails)
                  ? body.inviteEmails.length
                  : 0,
                recurringChildrenInserted: childrenInserted,
                autoAssignment: null as RunResult | null, // Will be set after transaction
              },
            },
          };
        } finally {
          await tx.$queryRaw`SELECT RELEASE_LOCK(${lockKey})`;
        }
      },
      { timeout: 10000 }
    );

    // Auto-assign interpreter AFTER transaction commits (if enabled and no interpreter specified)
    let autoAssignmentResult = null;
    if (
      result.body.success &&
      result.body.data?.bookingId &&
      !body.interpreterEmpCode
    ) {
      try {
        console.log(
          `🚀 Starting auto-assignment for booking ${result.body.data?.bookingId} (after transaction)`
        );
        // Compute and persist auto-assign scheduling fields for the parent booking
        try {
          const { scheduleAutoAssignForBooking } = await import("@/lib/assignment/scheduler/compute");
          await scheduleAutoAssignForBooking(result.body.data!.bookingId);
        } catch (e) {
          console.warn("⚠️ Failed to compute auto-assign schedule for parent:", e);
        }
        const { run } = await import("@/lib/assignment/core/run");

        // If this is a recurring booking, assign parent and all children individually
        if (body.isRecurring) {
          console.log(
            `🔄 Processing recurring booking with ${result.body.data?.recurringChildrenInserted} children`
          );

          // 1. Run auto-assignment for parent booking
          autoAssignmentResult = await run(result.body.data!.bookingId);
          console.log(
            `📊 Parent auto-assignment result:`,
            autoAssignmentResult
          );

          // 2. Get all child bookings for this parent
          const childBookings = await prisma.bookingPlan.findMany({
            where: { parentBookingId: result.body.data!.bookingId },
            select: { bookingId: true, timeStart: true, timeEnd: true },
          });
          console.log(
            `📋 Found ${childBookings.length} child bookings to assign individually`
          );

          // 3. Compute schedule and run auto-assignment for each child booking
          let successfulChildAssignments = 0;
          const childResults = [];

          for (const childBooking of childBookings) {
            try {
              // Compute and persist auto-assign schedule for child
              try {
                const { scheduleAutoAssignForBooking } = await import("@/lib/assignment/scheduler/compute");
                await scheduleAutoAssignForBooking(childBooking.bookingId);
              } catch (e) {
                console.warn(`⚠️ Failed to compute auto-assign schedule for child ${childBooking.bookingId}:`, e);
              }
              console.log(
                `🔄 Running auto-assignment for child booking ${childBooking.bookingId}`
              );
              const childResult = await run(childBooking.bookingId);
              childResults.push({
                bookingId: childBooking.bookingId,
                result: childResult,
              });

              if (childResult.status === "assigned") {
                successfulChildAssignments++;
                console.log(
                  `✅ Child booking ${childBooking.bookingId} assigned to ${childResult.interpreterId}`
                );
              } else {
                console.log(
                  `⚠️ Child booking ${childBooking.bookingId} assignment result: ${childResult.status} - ${childResult.reason}`
                );
              }
            } catch (error) {
              console.error(
                `❌ Failed to assign child booking ${childBooking.bookingId}:`,
                error
              );
              childResults.push({
                bookingId: childBooking.bookingId,
                result: { status: "escalated", reason: "assignment error" },
              });
            }
          }

          // 4. Update the result to show all assignments
          autoAssignmentResult = {
            ...autoAssignmentResult,
            childAssignments: successfulChildAssignments,
            totalChildren: childBookings.length,
            childResults: childResults,
            message: `Parent: ${autoAssignmentResult.status}, Children: ${successfulChildAssignments}/${childBookings.length} assigned`,
          };
        } else {
          // Non-recurring booking - normal flow
          autoAssignmentResult = await run(result.body.data!.bookingId);
          console.log(`📊 Auto-assignment result:`, autoAssignmentResult);
        }

        // Update the response with auto-assignment result
        if (result.body.data) {
          result.body.data.autoAssignment =
            autoAssignmentResult as RunResult | null;

          // If auto-assign escalated (no interpreter), compute forward suggestion for UI
          if (
            featureFlags.enableForwardUser &&
            autoAssignmentResult &&
            autoAssignmentResult.status !== "assigned"
          ) {
            try {
              const savedId = result.body.data.bookingId as number;
              // Find user's environment by owner center
              const bk = await prisma.bookingPlan.findUnique({
                where: { bookingId: savedId },
                select: {
                  timeStart: true,
                  timeEnd: true,
                  meetingType: true,
                  employee: { select: { deptPath: true } },
                },
              });
              let environmentId: number | null = null;
              if (bk?.employee?.deptPath) {
                const c = centerPart(bk.employee.deptPath);
                if (c) {
                  const envC = await prisma.environmentCenter.findUnique({
                    where: { center: c },
                    select: { environmentId: true },
                  });
                  environmentId = envC?.environmentId ?? null;
                }
              }

              // Capacity full in user's environment
              let capacityFull = false;
              if (environmentId != null && bk?.timeStart && bk?.timeEnd) {
                const rows = await prisma.$queryRaw<
                  Array<{ cnt: bigint | number }>
                >`
                  SELECT COUNT(DISTINCT bp.INTERPRETER_EMP_CODE) AS cnt
                  FROM BOOKING_PLAN bp
                  JOIN ENVIRONMENT_INTERPRETER ei ON ei.INTERPRETER_EMP_CODE = bp.INTERPRETER_EMP_CODE AND ei.ENVIRONMENT_ID = ${environmentId}
                  WHERE bp.INTERPRETER_EMP_CODE IS NOT NULL
                    AND bp.BOOKING_STATUS IN ('approve','waiting')
                    AND (bp.TIME_START < ${bk.timeEnd} AND bp.TIME_END > ${bk.timeStart})
                `;
                const busy = rows?.[0]?.cnt != null ? Number(rows[0].cnt) : 0;
                const total = await prisma.environmentInterpreter.count({
                  where: { environmentId },
                });
                capacityFull = total <= 0 ? true : total - busy <= 0;
              }

              const suggestion = {
                eligible: capacityFull,
                capacityFull,
                urgent: false,
                environmentId,
              };

              // Do not auto-forward here. UI will decide. Only return suggestion.
              (
                result.body.data as unknown as Record<string, unknown>
              ).forwardSuggestion = suggestion;
            } catch (e) {
              console.warn("Forward suggestion computation failed", e);
            }
          }
        }
      } catch (error) {
        console.error("❌ Auto-assignment failed:", error);
        if (result.body.data) {
          result.body.data.autoAssignment = {
            status: "escalated",
            reason: "auto-assignment error",
          };
        }
      }
    }

    return NextResponse.json<ApiResponse>(result.body as ApiResponse, {
      status: result.status,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "An unexpected error occurred while creating the booking",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: Add a GET method to retrieve bookings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const meetingRoom = searchParams.get("meetingRoom");

    const where: Record<string, unknown> = {};
    if (meetingRoom) where.meetingRoom = meetingRoom;

    const bookings = await prisma.bookingPlan.findMany({
      where,
      orderBy: { timeStart: "asc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      success: true,
      data: bookings,
      pagination: {
        limit,
        offset,
        total: await prisma.bookingPlan.count({ where }),
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "An unexpected error occurred while fetching bookings",
      },
      { status: 500 }
    );
  }
}
