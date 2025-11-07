"use client";

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
import { useMemo, useState, useEffect } from "react";
import {
  generateStandardTimeSlots,
  generateEndTimeSlots,
  formatYmdFromDate,
  buildDateTimeString,
  isValidStartTime,
  isValidTimeRange,
} from "@/utils/time";
import { toast } from "sonner";
import type { OwnerGroup } from "@/types/booking";
import type { BookingFormProps } from "@/types/props";
import type { MeetingType, DRType } from "@/prisma/prisma";
import { PersonalInfoSection } from "@/components/BookingForm/sections/PersonalInfoSection";
import { MeetingDetailsSection } from "@/components/BookingForm/sections/MeetingDetailsSection";

// Light, self-contained validators
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function RoomBookingForm({
  open,
  onOpenChange,
  selectedSlot,
  daysInMonth,
  dayOccupancy,
  maxLanes = 4,
  forwardMonthLimit = 1,
  initialMeetingRoom,
}: BookingFormProps & { initialMeetingRoom?: string }) {
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
  const [drType, setDrType] = useState<DRType | null>(null);
  const [otherType, setOtherType] = useState<string>("");
  const [otherTypeScope, setOtherTypeScope] = useState<
    "dr_type" | "meeting_type" | null
  >(null);
  const [meetingDetail, setMeetingDetail] = useState<string>("");
  const [applicableModel, setApplicableModel] = useState<string>("");
  const [meetingLink, setMeetingLink] = useState<string>("");
  const [chairmanEmail, setChairmanEmail] = useState<string>("");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Time slots
  const slotsTime = useMemo(() => generateStandardTimeSlots(), []);
  const allEndTimes = useMemo(() => generateEndTimeSlots(), []);
  const initialSlot = selectedSlot?.slot || "";

  const availableEndTimes = useMemo(() => {
    const effectiveStart = startTime || initialSlot;
    if (!effectiveStart) return allEndTimes;
    const startIdx = allEndTimes.findIndex((t) => t === effectiveStart);
    return startIdx >= 0 ? allEndTimes.slice(startIdx + 1) : allEndTimes;
  }, [startTime, initialSlot, allEndTimes]);

  const dayObj = useMemo(() => {
    if (!selectedSlot?.day) return undefined;
    const info = daysInMonth.find((d) => d.date === selectedSlot.day);
    return info ? { dayName: info.dayName, fullDate: info.fullDate } : undefined;
  }, [selectedSlot?.day, daysInMonth]);

  // Helper functions for time slot validation
  const getLocalDateString = (date: Date) => formatYmdFromDate(date);

  const isSameLocalDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isPastNowForSlot = (t: string) => {
    if (!dayObj?.fullDate) return false;
    const localDate = getLocalDateString(dayObj.fullDate);
    const isoLike = buildDateTimeString(localDate, t).replace(" ", "T");
    const slotStartDate = new Date(isoLike);
    const now = new Date();
    if (!isSameLocalDate(dayObj.fullDate, now)) return false;
    
    // Calculate slot end time (30 minutes after start)
    const slotEndDate = new Date(slotStartDate.getTime() + 30 * 60 * 1000);
    
    // Slot is past only if the END time has passed
    // Users can book as long as there's time remaining in the slot
    return slotEndDate <= now;
  };

  // Check if a start time slot should be disabled (past or fully occupied)
  const isStartDisabled = (t: string) => {
    if (isPastNowForSlot(t)) return true;
    if (!dayOccupancy) return false;
    const idx = slotsTime.indexOf(t);
    return idx >= 0 && dayOccupancy[idx] >= maxLanes;
  };

  // Check if an end time slot should be disabled
  const isEndDisabled = (t: string) => {
    if (!dayOccupancy || !startTime) return false;
    const startIdx = slotsTime.indexOf(startTime);
    const endIdx = slotsTime.indexOf(t);
    const endExclusive = endIdx === -1 ? slotsTime.length : endIdx;
    if (endExclusive <= startIdx) return true;
    for (let i = startIdx; i < endExclusive; i++) {
      if (dayOccupancy[i] >= maxLanes) return true;
    }
    return false;
  };

  // Initialize user profile (split full name when needed)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("booking.user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const first = String(parsed.firstNameEn || parsed.firstName || "").trim();
      const last = String(parsed.lastNameEn || parsed.lastName || "").trim();
      let outFirst = first;
      let outLast = last;
      if (!outFirst || !outLast) {
        const full = String(parsed.name || "").trim();
        if (full) {
          const parts = full.split(/\s+/).filter(Boolean);
          if (parts.length >= 2) {
            if (!outFirst) outFirst = parts[0];
            if (!outLast) outLast = parts.slice(1).join(" ");
          } else {
            if (!outFirst) outFirst = full;
            if (!outLast) outLast = "";
          }
        }
      }
      setOwnerName(outFirst);
      setOwnerSurname(outLast);
      setOwnerEmail(String(parsed.email || ""));
      setOwnerTel(String(parsed.phone || ""));
      if (parsed.empCode && typeof parsed.empCode === 'string') {
        const emp = parsed.empCode.toUpperCase();
        if (emp.startsWith('SW')) setOwnerGroup('software');
        else if (emp.startsWith('HW')) setOwnerGroup('hardware');
        else if (emp.startsWith('IOT')) setOwnerGroup('iot');
      }
    } catch {}
  }, []);

  // Keep DR/Other scope in sync
  const handleDrTypeChange = (v: DRType | null) => {
    setDrType(v);
    if (v === "Other") setOtherTypeScope("dr_type");
    else {
      setOtherType("");
      setOtherTypeScope(null);
    }
  };
  const handleOtherTypeChange = (v: string) => setOtherType(v);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!meetingRoom.trim()) e.meetingRoom = "Meeting room is required";
    if (!meetingType) e.meetingType = "Meeting type is required";
    if (!startTime) e.startTime = "Start time is required";
    if (!endTime) e.endTime = "End time is required";
    if (startTime && !isValidStartTime(startTime)) e.startTime = "Invalid start";
    if (startTime && endTime && !isValidTimeRange(startTime, endTime)) e.endTime = "End must be after start";

    // Check if start time is in the past
    try {
      if (startTime && dayObj?.fullDate && isPastNowForSlot(startTime)) {
        e.startTime = "Start time cannot be in the past";
      }
    } catch {}

    if (meetingType === "DR") {
      if (!drType) e.drType = "DR type is required";
      if (drType === "Other") {
        if (!otherType.trim()) e.otherType = "Please specify the other DR type";
        if (otherTypeScope !== "dr_type") e.otherType = "Scope must be 'dr_type'";
      } else {
        if (otherType.trim()) e.otherType = "Do not fill 'Other type' unless DR type is 'Other'";
        if (otherTypeScope) e.otherType = "Scope must be empty unless DR type is 'Other'";
      }
    } else if (meetingType === "Other") {
      if (!otherType.trim()) e.otherType = "Please specify the other meeting type";
      if (otherTypeScope !== "meeting_type") e.otherType = "Scope must be 'meeting_type'";
      if (drType) e.drType = "Do not select DR type for 'Other' meeting";
    } else {
      if (drType) e.drType = `DR type is not allowed for ${meetingType}`;
      if (otherType.trim()) e.otherType = `Other type is not allowed for ${meetingType}`;
      if (otherTypeScope) e.otherType = `Other type scope is not allowed for ${meetingType}`;
    }

    if (meetingLink && !/^https?:\/\//i.test(meetingLink.trim())) {
      e.meetingLink = "Link must start with http:// or https://";
    }
    if (chairmanEmail && !isValidEmail(chairmanEmail.trim())) {
      e.chairmanEmail = "Invalid chairman email";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!dayObj?.fullDate) return;
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const localDate = formatYmdFromDate(dayObj.fullDate);
      const startDateTime = buildDateTimeString(localDate, startTime);
      const endDateTime = buildDateTimeString(localDate, endTime);

      const raw = localStorage.getItem("booking.user");
      if (!raw) {
        toast.error("Your session has expired. Please sign in again.");
        return;
      }
      const parsed = JSON.parse(raw);
      const empCode = parsed.empCode as string | undefined;
      if (!empCode) {
        toast.error("Your session is invalid. Please sign in again.");
        return;
      }

      const body: Record<string, unknown> = {
        ownerEmpCode: empCode,
        ownerGroup,
        meetingRoom: meetingRoom.trim(),
        meetingType: meetingType as MeetingType,
        meetingDetail: meetingDetail.trim() || undefined,
        applicableModel: applicableModel.trim() || undefined,
        meetingLink: meetingLink.trim() ? meetingLink.trim() : null,
        chairmanEmail: chairmanEmail.trim() ? chairmanEmail.trim() : null,
        timeStart: startDateTime,
        timeEnd: endDateTime,
        bookingStatus: "waiting",
      };

      if (meetingType === "DR") {
        const drTypeMap: Record<DRType, string> = {
          DR_PR: "DR-PR",
          DR_k: "DR-k",
          DR_II: "DR-II",
          DR_I: "DR-I",
          Other: "Other",
        };
        body.drType = drType ? drTypeMap[drType] : null;
        if (drType === "Other") {
          body.otherType = otherType.trim();
          body.otherTypeScope = "dr_type";
        } else {
          body.otherType = null;
          body.otherTypeScope = null;
        }
      } else if (meetingType === "Other") {
        body.drType = null;
        body.otherType = otherType.trim();
        body.otherTypeScope = "meeting_type";
      } else {
        body.drType = null;
        body.otherType = null;
        body.otherTypeScope = null;
      }

      const res = await fetch("/api/booking-room/post-booking-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        try { json = await res.json(); } catch {}
      }

      if (res.status === 409) {
        const msg = json?.message || "Room conflict during requested time";
        toast.error(msg);
        return;
      }
      if (!res.ok) {
        const msg = json?.message || json?.error || `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }

      toast.success("Room booking created successfully");
      onOpenChange(false);
      try { window.dispatchEvent(new CustomEvent("booking:updated")); } catch {}
    } catch (err) {
      console.error("Error creating room booking:", err);
      toast.error("An error occurred while creating the booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (open) {
      setMeetingRoom(initialMeetingRoom || "");
      if (initialSlot) setStartTime(initialSlot);
      setEndTime("");
      setMeetingType(null);
      setDrType(null);
      setOtherType("");
      setOtherTypeScope(null);
      setMeetingLink("");
      setChairmanEmail("");
      setOpenDropdown(null);
    } else {
      setOpenDropdown(null);
    }
  }, [open, initialMeetingRoom, initialSlot]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle>Create Room Booking</SheetTitle>
          <SheetDescription>
            Reserve a meeting room. No interpreter is assigned in this flow.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="space-y-8 pb-12">
            <PersonalInfoSection
              ownerName={ownerName}
              ownerSurname={ownerSurname}
                ownerEmail={ownerEmail}
                ownerTel={ownerTel}
                onTelChange={setOwnerTel}
                ownerGroup={ownerGroup}
                errors={errors}
                onGroupChange={setOwnerGroup}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
              />

              <MeetingDetailsSection
                meetingRoom={meetingRoom}
                setMeetingRoom={setMeetingRoom}
                meetingType={meetingType}
                setMeetingType={setMeetingType}
                drType={drType}
                setDrType={handleDrTypeChange}
                otherType={otherType}
                setOtherType={handleOtherTypeChange}
                meetingDetail={meetingDetail}
                setMeetingDetail={setMeetingDetail}
                applicableModel={applicableModel}
                setApplicableModel={setApplicableModel}
                chairmanEmail={chairmanEmail}
                setChairmanEmail={setChairmanEmail}
                startTime={startTime || initialSlot}
                endTime={endTime}
                slotsTime={slotsTime}
                availableEndTimes={availableEndTimes}
                errors={errors}
                onStartChange={setStartTime}
                onEndChange={setEndTime}
                isStartDisabled={isStartDisabled}
                isEndDisabled={isEndDisabled}
                repeatChoice="none"
                handleRepeatChange={() => {}}
                recurrenceEndType="never"
                setRecurrenceEndType={() => {}}
                dayObj={dayObj}
                selectedSlot={selectedSlot}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                hideRecurrenceControls
                lockMeetingRoom
                chairmanOptional
              />
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border">
          <div className="flex items-center gap-2 ml-auto">
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create booking"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
