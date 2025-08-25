import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState, useEffect } from "react";
import {
  generateStandardTimeSlots,
  generateEndTimeSlots,
  timeToMinutes,
  formatYmdFromDate,
  buildDateTimeString,
  isValidStartTime,
  isValidTimeRange,
} from "@/utils/time";
import { Calendar, Clock } from "lucide-react";
import type { MeetingType } from "@/prisma/prisma";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import type { OwnerGroup } from "@/types/booking";
import type { BookingFormProps } from "@/types/props";
import { MAX_LANES } from "@/utils/constants";
import { PersonalInfoSection } from "@/components/BookingForm/sections/PersonalInfoSection";
import { MeetingDetailsSection } from "@/components/BookingForm/sections/MeetingDetailsSection";
import { AdditionalOptionsSection } from "@/components/BookingForm/sections/AdditionalOptionsSection";
import { InviteEmailsSection } from "@/components/BookingForm/sections/InviteEmailsSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
export function BookingForm({
  open,
  onOpenChange,
  selectedSlot,
  daysInMonth,
  interpreters = [],
  dayOccupancy,
}: BookingFormProps) {
  // Form state
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [ownerName, setOwnerName] = useState<string>("");
  const [ownerSurname, setOwnerSurname] = useState<string>("");
  const [ownerEmail, setOwnerEmail] = useState<string>("");
  const [ownerTel, setOwnerTel] = useState<string>("");
  const [ownerGroup, setOwnerGroup] = useState<OwnerGroup>("software");
  const [meetingRoom, setMeetingRoom] = useState<string>("");
  const [meetingType, setMeetingType] = useState<string | null>(null);
  const [meetingDetail, setMeetingDetail] = useState<string>("");
  const [interpreterId, setInterpreterId] = useState<string>("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState<string>("");

  // Recurrence state
  type RecurrenceTypeUi =
    | "daily"
    | "weekly"
    | "biweekly"
    | "monthly"
    | "custom";
  type EndTypeUi = "never" | "on_date" | "after_occurrences";
  type WeekOrderUi = "first" | "second" | "third" | "fourth" | "last";
  type MonthlyMode = "by_day" | "by_nth";

  const [repeatChoice, setRepeatChoice] = useState<"none" | RecurrenceTypeUi>(
    "none"
  );
  // const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceTypeUi | null>(
    null
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState<number | null>(
    null
  );
  const [recurrenceEndType, setRecurrenceEndType] =
    useState<EndTypeUi>("never");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");
  const [recurrenceEndOccurrences, setRecurrenceEndOccurrences] = useState<
    number | null
  >(null);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<string>(""); // csv sun,mon,...
  const [recurrenceMonthday, setRecurrenceMonthday] = useState<number | null>(
    null
  );
  const [recurrenceWeekOrder, setRecurrenceWeekOrder] =
    useState<WeekOrderUi | null>(null);
  const [customOpen, setCustomOpen] = useState<boolean>(false);
  const [monthlyMode, setMonthlyMode] = useState<MonthlyMode>("by_day");
  

  // Loading and error states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Set default start time based on selected slot
  useEffect(() => {
    setStartTime(selectedSlot?.slot || "");
  }, [open, selectedSlot?.slot]);

  const dayObj = selectedSlot
    ? daysInMonth.find((d) => d.date === selectedSlot.day)
    : undefined;

  // Get user data from localStorage (cached at login) and reset form when sheet opens/closes
  useEffect(() => {
    if (!open) {
      // Reset all form fields when sheet closes
      setStartTime("");
      setEndTime("");

      setOwnerName("");
      setOwnerSurname("");
      setOwnerEmail("");
      setOwnerTel("");
      setOwnerGroup("software");
      setMeetingRoom("");
      setMeetingDetail("");
      setMeetingType(null);
      setInterpreterId("");
      setInviteEmails([]);
      setNewEmail("");
      setErrors({});
      setIsSubmitting(false);
      // Reset recurrence
      setRepeatChoice("none");
      // setIsRecurring(false);
      setRecurrenceType(null);
      setRecurrenceInterval(null);
      setRecurrenceEndType("never");
      setRecurrenceEndDate("");
      setRecurrenceEndOccurrences(null);
      setRecurrenceWeekdays("");
      setRecurrenceMonthday(null);
      setRecurrenceWeekOrder(null);
      setCustomOpen(false);
    }
    if (open) {
      try {
        const raw = localStorage.getItem("booking.user");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        // Session is now enforced by server cookie; just read profile if present
        const full = String(parsed.name || "");
        const parts = full.trim().split(/\s+/);
        const first = parts[0] || "";
        const last = parts.slice(1).join(" ") || "";
        setOwnerName(first);
        setOwnerSurname(last);
        setOwnerEmail(parsed.email || "");
        setOwnerTel(parsed.phone || "");
      } catch {}
    }
  }, [open]);

  // Time slots generation (unified)
  const slotsTime = useMemo(() => generateStandardTimeSlots(), []);

  // timeToMinutes unified from utils/time

  // Get available end times based on selected start time
  const availableEndTimes = useMemo(() => {
    if (!startTime) return generateEndTimeSlots();
    const endSlots = generateEndTimeSlots();
    const startMinutes = timeToMinutes(startTime);
    return endSlots.filter((time) => timeToMinutes(time) > startMinutes);
  }, [startTime]);

  // Reset end time if it becomes invalid
  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (endTime && timeToMinutes(endTime) <= timeToMinutes(value)) {
      setEndTime("");
    }
  };

  const getLocalDateString = (date: Date) => formatYmdFromDate(date);

  // Phase 5: summary helpers
  const formatOrdinalDay = (n: number) => {
    const s = ["th", "st", "nd", "rd"]; const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };
  const formatShortDateFromYmd = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map((v) => Number(v));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };
  const weekdayCodeToShort = (code: string) => {
    const map: Record<string, string> = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
    return map[code] || code;
  };
  const formatWeekdayCsv = useMemo(() => {
    return (csv: string | null | undefined) => {
      const list = (csv || "").split(",").filter(Boolean).map((c) => weekdayCodeToShort(c.trim()));
      return list.join(", ");
    };
  }, []);

  const repeatSummary = useMemo(() => {
    if (repeatChoice === "none") return "";
    const type = (recurrenceType || repeatChoice) as RecurrenceTypeUi;
    const interval = Math.max(1, recurrenceInterval ?? (repeatChoice === "biweekly" ? 2 : 1));
    let base = "Repeat ";

    if (type === "daily") {
      base += interval > 1 ? `every ${interval} days` : "daily";
    } else if (type === "weekly" || type === "biweekly" || type === "custom") {
      const fallbackWdCode = dayObj?.fullDate
        ? ["sun","mon","tue","wed","thu","fri","sat"][dayObj.fullDate.getDay()]
        : "mon";
      const weekdaysText = formatWeekdayCsv(recurrenceWeekdays) || weekdayCodeToShort(fallbackWdCode);
      const weeksLabel = type === "biweekly" ? "every 2 weeks" : interval > 1 ? `every ${interval} weeks` : "weekly";
      base += `${weeksLabel} on ${weekdaysText}`;
    } else if (type === "monthly") {
      const hasNth = Boolean(recurrenceWeekOrder && recurrenceWeekdays);
      if (hasNth && recurrenceWeekOrder && recurrenceWeekdays && monthlyMode === "by_nth") {
        const ordLabel = recurrenceWeekOrder.charAt(0).toUpperCase() + recurrenceWeekOrder.slice(1);
        const dayLabel = weekdayCodeToShort((recurrenceWeekdays || "").split(",")[0] || "");
        base += interval > 1 ? `every ${interval} months on ${ordLabel} ${dayLabel}` : `monthly on ${ordLabel} ${dayLabel}`;
      } else if (monthlyMode === "by_day") {
        const md = recurrenceMonthday ?? (selectedSlot?.day || dayObj?.fullDate.getDate() || 1);
        base += interval > 1 ? `every ${interval} months on day ${md}` : `monthly on day ${md}`;
      }
    }

    if (recurrenceEndType === "after_occurrences" && recurrenceEndOccurrences) {
      return `${base} for ${recurrenceEndOccurrences} occurrences`;
    }
    if (recurrenceEndType === "on_date" && recurrenceEndDate) {
      const ymd = recurrenceEndDate.split(" ")[0];
      const dt = new Date(ymd + "T00:00:00");
      const showOrdinalOnly = true;
      if (showOrdinalOnly) {
        return `${base} until ${formatOrdinalDay(dt.getDate())}`;
      }
      return `${base} until ${formatShortDateFromYmd(ymd)}`;
    }
    return base;
  }, [repeatChoice, recurrenceType, recurrenceInterval, recurrenceWeekdays, recurrenceMonthday, recurrenceWeekOrder, recurrenceEndType, recurrenceEndDate, recurrenceEndOccurrences, selectedSlot?.day, dayObj?.fullDate, formatWeekdayCsv, monthlyMode]);

  // Phase 4: weekend preview helpers
  const isWeekend = (d: Date) => {
    const wd = d.getDay();
    return wd === 0 || wd === 6;
  };
  const parseYmd = (ymd: string): Date => {
    const only = ymd.split(" ")[0];
    return new Date(`${only}T00:00:00`);
  };
  const addDaysLocal = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addWeeksLocal = (d: Date, n: number) => addDaysLocal(d, n * 7);
  const addMonthsLocal = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
  const nthWeekdayOfMonth = (year: number, monthIndex: number, weekday: number, order: WeekOrderUi): Date => {
    const firstOfMonth = new Date(year, monthIndex, 1);
    const firstWeekdayIndex = firstOfMonth.getDay();
    let dayOfMonth = 1 + ((7 + weekday - firstWeekdayIndex) % 7);
    const orderToOffset: Record<WeekOrderUi, number> = {
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
    const lastOfMonth = new Date(year, monthIndex + 1, 0);
    const lastWeekday = lastOfMonth.getDay();
    const diff = (7 + lastWeekday - weekday) % 7;
    return new Date(year, monthIndex + 1, lastOfMonth.getDate() - diff);
  };
  const previewRecurringDates = (): Date[] => {
    if (!dayObj || repeatChoice === "none") return [];
    const type = (recurrenceType || repeatChoice) as RecurrenceTypeUi;
    const interval = Math.max(1, recurrenceInterval ?? (repeatChoice === "biweekly" ? 2 : 1));
    const maxTotal = 52;
    const until = recurrenceEndType === "on_date" && recurrenceEndDate ? parseYmd(recurrenceEndDate) : null;
    const start = new Date(dayObj.fullDate.getFullYear(), dayObj.fullDate.getMonth(), dayObj.fullDate.getDate());
    const dates: Date[] = [];
    const pushIf = (d: Date) => {
      if (dates.length >= maxTotal) return false;
      if (until && d > until) return false;
      dates.push(d);
      return true;
    };
    if (type === "daily") {
      for (let i = 1; i < maxTotal; i++) {
        const cand = addDaysLocal(start, i * interval);
        if (!pushIf(cand)) break;
      }
    } else if (type === "weekly" || type === "biweekly" || type === "custom") {
      const actualInterval = type === "biweekly" ? 2 : interval;
      const csv = (recurrenceWeekdays || "").trim();
      const weekdays = csv
        ? csv
            .split(",")
            .map((d) => ["sun","mon","tue","wed","thu","fri","sat"].indexOf(d.trim()))
            .filter((n) => n >= 0)
        : [start.getDay()];
      let weekStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      weekStart = addDaysLocal(weekStart, -weekStart.getDay());
      for (let w = 0; w < maxTotal; w++) {
        if (w >= 1) weekStart = addWeeksLocal(weekStart, actualInterval);
        for (const wd of weekdays) {
          const cand = addDaysLocal(weekStart, wd);
          if (cand.getTime() === start.getTime()) continue;
          if (!pushIf(cand)) return dates;
        }
      }
    } else if (type === "monthly") {
      const csv = (recurrenceWeekdays || "").trim();
      const hasNth = Boolean(recurrenceWeekOrder && csv);
      const weekdayIndex = csv ? ["sun","mon","tue","wed","thu","fri","sat"].indexOf(csv.split(",")[0].trim()) : start.getDay();
      const monthday = recurrenceMonthday ?? start.getDate();
      for (let m = 1; m < maxTotal; m++) {
        const base = addMonthsLocal(start, m * interval);
        let cand: Date | null = null;
        if (hasNth && recurrenceWeekOrder) {
          cand = nthWeekdayOfMonth(base.getFullYear(), base.getMonth(), weekdayIndex, recurrenceWeekOrder);
        } else {
          const yr = base.getFullYear();
          const mo = base.getMonth();
          const lastDay = new Date(yr, mo + 1, 0).getDate();
          if (monthday <= lastDay) {
            cand = new Date(yr, mo, monthday);
          } else {
            cand = null; // skip months without the target day (e.g., 29/30/31)
          }
        }
        if (cand && !pushIf(cand)) break;
      }
    }
    return dates;
  };

  // Occupancy-aware disabling
  const isStartDisabled = (t: string) => {
    if (!dayOccupancy) return false;
    const idx = slotsTime.indexOf(t);
    return idx >= 0 && dayOccupancy[idx] >= MAX_LANES;
  };

  const isEndDisabled = (t: string) => {
    if (!dayOccupancy || !startTime) return false;
    const startIdx = slotsTime.indexOf(startTime);
    const endIdx = slotsTime.indexOf(t);
    const endExclusive = endIdx === -1 ? slotsTime.length : endIdx;
    if (endExclusive <= startIdx) return true;
    for (let i = startIdx; i < endExclusive; i++) {
      if (dayOccupancy[i] >= MAX_LANES) return true;
    }
    return false;
  };

  // Repeat helpers
  const weekdayIdxToCode = (idx: number): string =>
    ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][idx] || "mon";
  const selectedDayCode = dayObj?.fullDate
    ? weekdayIdxToCode(dayObj.fullDate.getDay())
    : "mon";

  const handleRepeatChange = (value: "none" | RecurrenceTypeUi) => {
    setRepeatChoice(value);
    if (value === "none") {
      setRecurrenceEndType("never");
      setRecurrenceEndDate("");
      setRecurrenceEndOccurrences(null);
    } else {
      // default to end on a date when repeat is enabled
      if (recurrenceEndType === "never") {
        setRecurrenceEndType("on_date");
      }
    }
    if (value === "none") {
      setRecurrenceType(null);
      setRecurrenceInterval(null);
      setRecurrenceEndType("never");
      setRecurrenceEndDate("");
      setRecurrenceEndOccurrences(null);
      setRecurrenceWeekdays("");
      setRecurrenceMonthday(null);
      setRecurrenceWeekOrder(null);
      setMonthlyMode("by_day");
      return;
    }
    // setIsRecurring(true);
    if (value === "daily") {
      setRecurrenceType("daily");
      setRecurrenceInterval(1);
      setRecurrenceWeekdays("");
      setRecurrenceMonthday(null);
      setRecurrenceWeekOrder(null);
    } else if (value === "weekly") {
      setRecurrenceType("weekly");
      setRecurrenceInterval(1);
      setRecurrenceWeekdays(selectedDayCode);
      setRecurrenceMonthday(null);
      setRecurrenceWeekOrder(null);
    } else if (value === "biweekly") {
      setRecurrenceType("biweekly");
      setRecurrenceInterval(2);
      setRecurrenceWeekdays(selectedDayCode);
      setRecurrenceMonthday(null);
      setRecurrenceWeekOrder(null);
    } else if (value === "monthly") {
      setRecurrenceType("monthly");
      setRecurrenceInterval(1);
      setRecurrenceMonthday(
        selectedSlot?.day || dayObj?.fullDate.getDate() || 1
      );
      setRecurrenceWeekdays("");
      setRecurrenceWeekOrder(null);
      setMonthlyMode("by_day");
    } else if (value === "custom") {
      setRecurrenceType("weekly");
      setRecurrenceInterval(1);
      setRecurrenceWeekdays(selectedDayCode);
      setRecurrenceMonthday(null);
      setRecurrenceWeekOrder(null);
      setCustomOpen(true);
      setMonthlyMode("by_day");
    }
  };

  // Email management functions
  const addInviteEmail = () => {
    if (
      newEmail &&
      isValidEmail(newEmail) &&
      !inviteEmails.includes(newEmail)
    ) {
      setInviteEmails([...inviteEmails, newEmail]);
      setNewEmail("");
    }
  };

  const removeInviteEmail = (emailToRemove: string) => {
    setInviteEmails(inviteEmails.filter((email) => email !== emailToRemove));
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!meetingRoom.trim()) newErrors.meetingRoom = "Meeting room is required";
    if (!meetingType) newErrors.meetingType = "Meeting type is required";
    if (!startTime) newErrors.startTime = "Start time is required";
    if (!endTime) newErrors.endTime = "End time is required";
    if (startTime && !isValidStartTime(startTime))
      newErrors.startTime = "Invalid start time";
    if (startTime && endTime && !isValidTimeRange(startTime, endTime))
      newErrors.endTime = "End must be after start";

    // If you want to keep UI silent, we won't show an inline error here.

    if (repeatChoice !== "none") {
      if (recurrenceEndType === "never") {
        newErrors.recurrenceEndType = "Please choose an end option";
      } else if (recurrenceEndType === "on_date" && !recurrenceEndDate) {
        newErrors.recurrenceEndDate = "Select an end date";
      } else if (
        recurrenceEndType === "after_occurrences" &&
        (!recurrenceEndOccurrences || recurrenceEndOccurrences < 1)
      ) {
        newErrors.recurrenceEndOccurrences = "Enter occurrences (>= 1)";
      }
    }

    setErrors(newErrors);
    console.log("ERROR IS = ", newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!dayObj) return;

    // Phase 4: Preview weekends for non-occurrence flows and prompt user
    let applySkipWeekends = false;
    if (repeatChoice !== "none") {
      const preview = previewRecurringDates();
      const hasWeekend = preview.some((d) => isWeekend(d));
      if (hasWeekend) {
        const choice = await new Promise<"skip"|"cancel">((resolve) => {
          toast.custom(
            (t) => (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-[420px]">
                <Alert className="border-none p-0">
                  <AlertTitle className="text-gray-900">
                    <span className="text-amber-600 font-semibold">Weekend included</span>
                    <span className="ml-1"> Some occurrences fall on Sat/Sun.</span>
                  </AlertTitle>
                  <AlertDescription className="text-gray-700">
                    Choose an option.
                  </AlertDescription>
                </Alert>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => { toast.dismiss(t); resolve("cancel"); }}
                    className="bg-gray-200 text-gray-900 px-3 py-1 rounded text-xs"
                  >
                    Cancel All
                  </button>
                  <button
                    onClick={() => { toast.dismiss(t); resolve("skip"); }}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                  >
                    Cancel weekend
                  </button>
                </div>
              </div>
            ),
            { duration: 12000 }
          );
        });
        if (choice === "cancel") return;
        if (choice === "skip") applySkipWeekends = true;
      }
    }

    setIsSubmitting(true);

    try {
      // Create the datetime strings (plain strings YYYY-MM-DD HH:mm:ss)
      const localDate = getLocalDateString(dayObj.fullDate);
      const startDateTime = buildDateTimeString(localDate, startTime);
      const endDateTime = buildDateTimeString(localDate, endTime);

      // Get empCode from localStorage
      const raw = localStorage.getItem("booking.user");
      if (!raw) {
        alert("User session expired. Please login again.");
        return;
      }
      const parsed = JSON.parse(raw);
      const empCode = parsed.empCode;
      if (!empCode) {
        alert("User session invalid. Please login again.");
        return;
      }

      const bookingData = {
        ownerEmpCode: empCode,
        ownerGroup,
        meetingRoom: meetingRoom.trim(),
        meetingType: meetingType as MeetingType,
        meetingDetail: meetingDetail.trim() || undefined,
        timeStart: startDateTime,
        timeEnd: endDateTime,
        bookingStatus: "waiting", // Default to waiting
        inviteEmails: inviteEmails.length > 0 ? inviteEmails : undefined,
      };

      // Merge recurrence into payload
      let recurrencePayload: Record<string, unknown> = {};
      if (repeatChoice !== "none") {
        recurrencePayload = {
          isRecurring: true,
          recurrenceType: recurrenceType || repeatChoice,
          recurrenceInterval:
            recurrenceInterval ?? (repeatChoice === "biweekly" ? 2 : 1),
          recurrenceEndType,
          recurrenceEndDate:
            recurrenceEndType === "on_date" ? recurrenceEndDate || null : null,
          recurrenceEndOccurrences:
            recurrenceEndType === "after_occurrences"
              ? recurrenceEndOccurrences ?? 5
              : null,
          recurrenceWeekdays:
            recurrenceType === "weekly" ||
            repeatChoice === "weekly" ||
            repeatChoice === "biweekly"
              ? recurrenceWeekdays || selectedDayCode
              : recurrenceType === "monthly"
              ? recurrenceWeekdays || null
              : recurrenceWeekdays || null,
          recurrenceMonthday:
            recurrenceType === "monthly" || repeatChoice === "monthly"
              ? recurrenceMonthday ??
                (selectedSlot?.day || dayObj?.fullDate.getDate() || 1)
              : null,
          recurrenceWeekOrder:
            recurrenceType === "monthly" ? recurrenceWeekOrder || null : null,
          skipWeekends: applySkipWeekends || undefined,
        };
      }

      const submitOnce = async (force?: boolean) => {
        const response = await fetch("/api/booking-data/post-booking-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...bookingData,
            ...recurrencePayload,
            ...(force ? { force: true } : {}),
          }),
        });
        const result = await response.json();
        return { response, result } as const;
      };

      // First attempt without force
      let { response, result } = await submitOnce(false);

      // If overlap warning, show themed confirm toast and then force submit on OK
      if (response.status === 409 && result?.code === "OVERLAP_WARNING") {
        const proceed = await new Promise<boolean>((resolve) => {
          toast.custom(
            (t) => (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-[420px]">
                <Alert className="border-none p-0">
                  <AlertTitle className="text-gray-900">
                    <span className="text-amber-600 font-semibold">
                      Same room warning
                    </span>
                    <span className="ml-1">
                      {result?.message ||
                        "This room already has a booking overlapping this time."}
                    </span>
                  </AlertTitle>
                  <AlertDescription className="text-gray-700">
                    Do you want to continue?
                  </AlertDescription>
                </Alert>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      toast.dismiss(t);
                      resolve(false);
                    }}
                    className="bg-gray-200 text-gray-900 px-3 py-1 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      toast.dismiss(t);
                      resolve(true);
                    }}
                    className="bg-gray-900 text-white px-3 py-1 rounded text-xs"
                  >
                    OK
                  </button>
                </div>
              </div>
            ),
            { duration: 10000 }
          );
        });

        if (proceed) {
          ({ response, result } = await submitOnce(true));
        } else {
          return; // user cancelled
        }
      }

      if (result.success) {
        const bookingDate = dayObj?.fullDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const duration = `${startTime} - ${endTime}`;
        toast.custom(
          (t) => (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-[420px]">
              <Alert className="border-none p-0">
                <AlertTitle className="text-gray-900">
                  <span className="text-green-600 font-semibold">Success</span>
                  <span className="ml-1">Booking created successfully!</span>
                </AlertTitle>
                <AlertDescription className="text-gray-700">
                  {bookingDate} at {duration}
                </AlertDescription>
              </Alert>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => toast.dismiss(t)}
                  className="bg-gray-900 text-white px-3 py-1 rounded text-xs"
                >
                  OK
                </button>
              </div>
            </div>
          ),
          { duration: 5000 }
        );
        // Close the form
        onOpenChange(false);
        // Notify other components that bookings have changed
        try {
          window.dispatchEvent(new CustomEvent("booking:updated"));
        } catch {}
      } else {
        toast.custom(
          (t) => (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-[420px]">
              <Alert className="border-none p-0">
                <AlertTitle className="text-gray-900">
                  <span className="text-red-600 font-semibold">Error</span>
                  <span className="ml-1">Unable to create booking</span>
                </AlertTitle>
                <AlertDescription className="text-gray-700">
                  {result.message || result.error || "Please try again"}
                </AlertDescription>
              </Alert>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => toast.dismiss(t)}
                  className="bg-gray-900 text-white px-3 py-1 rounded text-xs"
                >
                  OK
                </button>
              </div>
            </div>
          ),
          { duration: 5000 }
        );
        if (result.details) {
          console.error("Validation errors:", result.details);
        }
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.custom(
        (t) => (
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-[420px]">
            <Alert className="border-none p-0">
              <AlertTitle className="text-gray-900">
                <span className="text-red-600 font-semibold">Error</span>
                <span className="ml-1">Unable to create booking</span>
              </AlertTitle>
              <AlertDescription className="text-gray-700">
                An error occurred while creating the booking
              </AlertDescription>
            </Alert>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => toast.dismiss(t)}
                className="bg-gray-900 text-white px-3 py-1 rounded text-xs"
              >
                OK
              </button>
            </div>
          </div>
        ),
        { duration: 5000 }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Interperter Booking Form
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Booking for:{" "}
            <strong className="text-foreground">
              {dayObj?.dayName} {selectedSlot?.day}
            </strong>
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="size-full overflow-auto">
          <form className="space-y-8 p-6" role="form" aria-label="Interpreter booking form">
            <fieldset className="space-y-6">
              <legend className="sr-only">Personal Information</legend>
              <PersonalInfoSection
                ownerName={ownerName}
                ownerSurname={ownerSurname}
                ownerEmail={ownerEmail}
                ownerTel={ownerTel}
                ownerGroup={ownerGroup}
                errors={errors}
                onGroupChange={setOwnerGroup}
              />
            </fieldset>

            <fieldset className="space-y-6">
              <legend className="sr-only">Meeting Details and Schedule</legend>
              <MeetingDetailsSection
                meetingRoom={meetingRoom}
                setMeetingRoom={(v) => setMeetingRoom(v)}
                meetingType={meetingType}
                setMeetingType={(v) => setMeetingType(v)}
                meetingDetail={meetingDetail}
                setMeetingDetail={(v) => setMeetingDetail(v)}
                startTime={startTime}
                endTime={endTime}
                slotsTime={slotsTime}
                availableEndTimes={availableEndTimes}
                errors={errors}
                onStartChange={handleStartTimeChange}
                onEndChange={setEndTime}
                isStartDisabled={isStartDisabled}
                isEndDisabled={isEndDisabled}
                repeatSection={
                  <div className="space-y-4">
                    {/* First row: Repeat Schedule and Until */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="repeatSelect">
                          Repeat Schedule
                        </label>
                        <Select
                          value={repeatChoice}
                          onValueChange={(v: "none" | RecurrenceTypeUi) =>
                            handleRepeatChange(v)
                          }
                        >
                          <SelectTrigger id="repeatSelect" className="w-full">
                            <SelectValue placeholder="No repeat" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No repeat</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">
                              Weekly on {dayObj?.dayName || "day"}
                            </SelectItem>
                            <SelectItem value="biweekly">
                              2 Weekly on {dayObj?.dayName || "day"}
                            </SelectItem>
                            <SelectItem value="monthly">
                              Monthly on day{" "}
                              {selectedSlot?.day || dayObj?.fullDate.getDate() || 1}
                            </SelectItem>
                            <SelectItem value="custom">Custom…</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Until...
                        </label>
                        <Select
                          value={repeatChoice !== "none" ? (recurrenceEndType === "never" ? "on_date" : recurrenceEndType) : ""}
                          onValueChange={(v) => setRecurrenceEndType(v as EndTypeUi)}
                          disabled={repeatChoice === "none"}
                        >
                          <SelectTrigger 
                            className={`w-full ${repeatChoice === "none" ? "opacity-50 cursor-not-allowed" : ""}`} 
                            aria-label="Select how recurrence should end"
                          >
                            <SelectValue placeholder="Repeat Option" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_date">On date</SelectItem>
                            <SelectItem value="after_occurrences">After occurrences</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Second row: Until options (date/occurrences) if repeat is selected */}
                    {repeatChoice !== "none" && (
                      <div className="space-y-3">
                        {recurrenceEndType === "on_date" && (
                          <div className="space-y-2">
                            <Input
                              type="date"
                              value={recurrenceEndDate ? recurrenceEndDate.split(" ")[0] : ""}
                              onChange={(e) => {
                                const ymd = e.target.value;
                                setRecurrenceEndDate(ymd ? `${ymd} 00:00:00` : "");
                              }}
                              className="w-full"
                              aria-label="Select end date for recurrence"
                              placeholder="Repeat Option"
                            />
                          </div>
                        )}
                        
                        {recurrenceEndType === "after_occurrences" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground whitespace-nowrap">After</span>
                              <Input
                                type="number"
                                min={1}
                                value={recurrenceEndOccurrences ?? 5}
                                onChange={(e) =>
                                  setRecurrenceEndOccurrences(
                                    Math.max(1, Number(e.target.value) || 1)
                                  )
                                }
                                className="w-20"
                                aria-label="Number of occurrences"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">occurrences</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Third row: Summary - Full width */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Summary
                      </label>
                      <div className="p-3 bg-muted/50 rounded-md border min-h-[60px] flex items-center w-full">
                        {repeatChoice !== "none" && repeatSummary ? (
                          <span className="text-sm text-muted-foreground">{repeatSummary}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No repeat selected</span>
                        )}
                      </div>
                    </div>
                      
                    {repeatChoice === "custom" && (
                      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">Edit custom</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Custom recurrence</DialogTitle>
                          </DialogHeader>
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">
                                Repeat pattern
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">Repeat every</span>
                                <Input
                                  type="number"
                                  min={1}
                                  value={recurrenceInterval ?? 1}
                                  onChange={(e) =>
                                    setRecurrenceInterval(
                                      Math.max(1, Number(e.target.value) || 1)
                                    )
                                  }
                                  className="w-20"
                                />
                                <Select
                                  value={
                                    recurrenceType === "daily"
                                      ? "day"
                                      : recurrenceType === "monthly"
                                      ? "month"
                                      : "week"
                                  }
                                  onValueChange={(unit) => {
                                    if (unit === "day") {
                                      setRecurrenceType("daily");
                                      setRecurrenceWeekdays("");
                                      setRecurrenceMonthday(null);
                                      setRecurrenceWeekOrder(null);
                                    } else if (unit === "week") {
                                      setRecurrenceType("weekly");
                                    } else {
                                      setRecurrenceType("monthly");
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="day">day(s)</SelectItem>
                                    <SelectItem value="week">
                                      week(s)
                                    </SelectItem>
                                    <SelectItem value="month">
                                      month(s)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {recurrenceType === "weekly" && (
                                <div className="space-y-2">
                                  <div className="text-sm">On days</div>
                                  <div className="flex flex-wrap gap-2">
                                    {[
                                      "sun",
                                      "mon",
                                      "tue",
                                      "wed",
                                      "thu",
                                      "fri",
                                      "sat",
                                    ].map((code, idx) => {
                                      const labels = [
                                        "S",
                                        "M",
                                        "T",
                                        "W",
                                        "T",
                                        "F",
                                        "S",
                                      ] as const;
                                      const active = (recurrenceWeekdays || "")
                                        .split(",")
                                        .includes(code);
                                      return (
                                        <Toggle
                                          key={code}
                                          pressed={active}
                                          onPressedChange={(on) => {
                                            const set = new Set(
                                              (recurrenceWeekdays || "")
                                                .split(",")
                                                .filter(Boolean)
                                            );
                                            if (on) set.add(code);
                                            else set.delete(code);
                                            setRecurrenceWeekdays(
                                              Array.from(set).join(",")
                                            );
                                          }}
                                        >
                                          {labels[idx]}
                                        </Toggle>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {recurrenceType === "monthly" && (
                                <div className="grid grid-cols-2 gap-3 items-end">
                                  <div className="col-span-2">
                                    <RadioGroup
                                      value={monthlyMode}
                                      onValueChange={(v) => {
                                        const mode = v as MonthlyMode;
                                        setMonthlyMode(mode);
                                        if (mode === "by_day") {
                                          setRecurrenceWeekOrder(null);
                                          setRecurrenceWeekdays("");
                                          setRecurrenceMonthday(
                                            recurrenceMonthday ??
                                              (selectedSlot?.day ||
                                                dayObj?.fullDate.getDate() ||
                                                1)
                                          );
                                        } else {
                                          setRecurrenceMonthday(null);
                                          if (!recurrenceWeekdays) setRecurrenceWeekdays("mon");
                                          if (!recurrenceWeekOrder) setRecurrenceWeekOrder("first");
                                        }
                                      }}
                                      className="grid grid-cols-2 gap-4"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2 mb-2">
                                          <RadioGroupItem value="by_day" id="modeByDay" />
                                          <label htmlFor="modeByDay" className="text-sm">By day of month</label>
                                        </div>
                                        <div className="space-y-2 pl-6">
                                          <div className="text-sm">On day (1..31)</div>
                                          <Input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={(monthlyMode === "by_day"
                                              ? (recurrenceMonthday ?? (selectedSlot?.day || dayObj?.fullDate.getDate() || 1))
                                              : (recurrenceMonthday ?? 1))}
                                            onChange={(e) =>
                                              setRecurrenceMonthday(
                                                Math.min(31, Math.max(1, Number(e.target.value) || 1))
                                              )
                                            }
                                            disabled={monthlyMode !== "by_day"}
                                            className="w-28"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2 mb-2">
                                          <RadioGroupItem value="by_nth" id="modeByNth" />
                                          <label htmlFor="modeByNth" className="text-sm">By nth weekday</label>
                                        </div>
                                        <div className="space-y-2 pl-6">
                                          <div className="flex gap-2">
                                            <Select
                                              value={recurrenceWeekOrder ?? undefined}
                                              onValueChange={(v) => setRecurrenceWeekOrder(v as WeekOrderUi)}
                                              disabled={monthlyMode !== "by_nth"}
                                            >
                                              <SelectTrigger className="w-32">
                                                <SelectValue placeholder="Order" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="first">First</SelectItem>
                                                <SelectItem value="second">Second</SelectItem>
                                                <SelectItem value="third">Third</SelectItem>
                                                <SelectItem value="fourth">Fourth</SelectItem>
                                                <SelectItem value="last">Last</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <Select
                                              value={(recurrenceWeekdays || "").split(",")[0] || undefined}
                                              onValueChange={(v) => setRecurrenceWeekdays(v)}
                                              disabled={monthlyMode !== "by_nth"}
                                            >
                                              <SelectTrigger className="w-32">
                                                <SelectValue placeholder="Day" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="sun">Sunday</SelectItem>
                                                <SelectItem value="mon">Monday</SelectItem>
                                                <SelectItem value="tue">Tuesday</SelectItem>
                                                <SelectItem value="wed">Wednesday</SelectItem>
                                                <SelectItem value="thu">Thursday</SelectItem>
                                                <SelectItem value="fri">Friday</SelectItem>
                                                <SelectItem value="sat">Saturday</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      </div>
                                    </RadioGroup>
                                  </div>
                                </div>
                              )}
                              {/* End controls moved outside of the custom dialog */}
                            </CardContent>
                          </Card>
                          <DialogFooter>
                            <Button onClick={() => setCustomOpen(false)}>
                              Done
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                }
              />
            </fieldset>

            <fieldset className="space-y-6">
              <legend className="sr-only">Additional Options</legend>
              <AdditionalOptionsSection
                interpreterId={interpreterId}
                setInterpreterId={(v) => setInterpreterId(v)}
                interpreters={interpreters}
              />
            </fieldset>

            <fieldset className="space-y-6">
              <legend className="sr-only">Invite Participants</legend>
              <InviteEmailsSection
                inviteEmails={inviteEmails}
                newEmail={newEmail}
                setNewEmail={(v) => setNewEmail(v)}
                addInviteEmail={addInviteEmail}
                removeInviteEmail={removeInviteEmail}
                isValidEmail={isValidEmail}
              />
            </fieldset>
          </form>
        </ScrollArea>
        <SheetFooter className="border-t pt-6 pb-4">
          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <SheetClose asChild>
              <Button 
                variant="outline" 
                className="flex-1 min-h-11"
                type="button"
              >
                Cancel
              </Button>
            </SheetClose>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 min-h-11"
              variant="default"
              type="submit"
            >
              {isSubmitting ? "Creating..." : "Create Booking"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
