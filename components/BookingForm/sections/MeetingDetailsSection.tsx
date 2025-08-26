import type React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeRangeSelector } from "@/components/BookingForm/components/TimeRangeSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Presentation } from "lucide-react";
import type { DRType } from "@/prisma/prisma";

interface MeetingDetailsSectionProps {
  meetingRoom: string;
  setMeetingRoom: (value: string) => void;
  meetingType?: string | null;
  setMeetingType?: (value: string | null) => void;
  meetingDetail: string;
  setMeetingDetail: (value: string) => void;
  applicableModel?: string;
  setApplicableModel?: (value: string) => void;

  drType?: DRType | null;
  setDrType?: (value: DRType | null) => void;
  otherType?: string;
  setOtherType?: (value: string) => void;

  startTime: string;
  endTime: string;
  slotsTime: string[];
  availableEndTimes: string[];
  errors: Record<string, string>;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  isStartDisabled?: (t: string) => boolean;
  isEndDisabled?: (t: string) => boolean;
  repeatSection?: React.ReactNode;
  openDropdown?: string | null;
  setOpenDropdown?: (value: string | null) => void;
  repeatChoice: "none" | "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  handleRepeatChange: (value: "none" | "daily" | "weekly" | "biweekly" | "monthly" | "custom") => void;
  recurrenceEndType: "never" | "on_date" | "after_occurrences";
  setRecurrenceEndType: (value: "never" | "on_date" | "after_occurrences") => void;
  dayObj?: { dayName?: string; fullDate?: Date };
  selectedSlot?: { day?: number; slot?: string };
}

export function MeetingDetailsSection({
  meetingRoom,
  setMeetingRoom,
  meetingType,
  setMeetingType,
  drType,
  setDrType,
  otherType,
  setOtherType,
  meetingDetail,
  setMeetingDetail,
  applicableModel,
  setApplicableModel,
  startTime,
  endTime,
  slotsTime,
  availableEndTimes,
  errors,
  onStartChange,
  onEndChange,
  isStartDisabled,
  isEndDisabled,
  repeatSection,
  openDropdown,
  setOpenDropdown,
  repeatChoice,
  handleRepeatChange,
  recurrenceEndType,
  setRecurrenceEndType,
  dayObj,
  selectedSlot,
}: MeetingDetailsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Presentation className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Meeting Details</h2>
      </div>

      {/* Line 1: Meeting Room, Meeting Type, DR Type, Other Type */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="meetingRoom" className="text-sm font-medium text-foreground">
            Meeting Room <span className="text-destructive">*</span>
          </Label>
          <Input
            id="meetingRoom"
            placeholder="Enter meeting room"
            value={meetingRoom}
            onChange={(e) => setMeetingRoom(e.target.value)}
            className={errors.meetingRoom ? "border-destructive focus:border-destructive" : ""}
            aria-describedby={errors.meetingRoom ? "meetingRoom-error" : undefined}
          />

        </div>

        <div className="space-y-2">
          <Label htmlFor="meetingType" className="text-sm font-medium text-foreground">
            Meeting Type <span className="text-destructive">*</span>
          </Label>
          
          <Select
            value={meetingType ?? undefined}
            onValueChange={(v) => setMeetingType && setMeetingType(v)}
            open={openDropdown === "meetingType"}
            onOpenChange={(open) => setOpenDropdown?.(open ? "meetingType" : null)}
          >
            <SelectTrigger
              id="meetingType"
              className={`w-full ${errors.meetingType ? "border-destructive focus:border-destructive" : ""}`}
              aria-describedby={errors.meetingType ? "meetingType-error" : undefined}
            >
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DR">DR</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="Weekly">Weekly</SelectItem>
              <SelectItem value="General">General</SelectItem>
              <SelectItem value="Augent">Augent</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>

        </div>

        <div className="space-y-2">
          <Label htmlFor="drType" className="text-sm font-medium text-foreground">
            DR Type 
          </Label>
          <Select
            value={drType ?? undefined}
            onValueChange={(v: DRType) => setDrType && setDrType(v)}
            open={openDropdown === "drType"}
            onOpenChange={(open) => setOpenDropdown?.(open ? "drType" : null)}
            disabled={meetingType !== "DR"}
          >
            <SelectTrigger 
              id="drType" 
              className={`w-full ${errors.drType ? "border-destructive focus:border-destructive" : ""} ${meetingType !== "DR" ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-describedby={errors.drType ? "drType-error" : undefined}
            >
              <SelectValue placeholder="Select DR type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PR_PR">PR-PR</SelectItem>
              <SelectItem value="DR_k">DR-k</SelectItem>
              <SelectItem value="DR_II">DR-II</SelectItem>
              <SelectItem value="DR_I">DR-I</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>

        </div>

        <div className="space-y-2">
          <Label htmlFor="otherType" className="text-sm font-medium text-foreground">
            Other Type
          </Label>
          <Input
            id="otherType"
            placeholder={meetingType === "DR" ? "Describe DR type..." : "Describe meeting type..."}
            value={otherType || ""}
            onChange={(e) => setOtherType && setOtherType(e.target.value)}
            className={`${errors.otherType ? "border-destructive focus:border-destructive" : ""} ${((meetingType === "DR" && drType === "Other") || meetingType === "Other") ? "" : "opacity-50 cursor-not-allowed"}`}
            aria-describedby={errors.otherType ? "otherType-error" : undefined}
            maxLength={255}
            disabled={!((meetingType === "DR" && drType === "Other") || meetingType === "Other")}
          />

        </div>
      </div>


            {/* Line 2: Meeting Time, Repeat Schedule, Until... */}
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4 items-start">
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground" htmlFor="meeting-time">
            Meeting Time <span className="text-destructive">*</span>
          </Label>
          <TimeRangeSelector
            startTime={startTime}
            endTime={endTime}
            slotsTime={slotsTime}
            availableEndTimes={availableEndTimes}
            startTimeError={errors.startTime}
            endTimeError={errors.endTime}
            onStartChange={onStartChange}
            onEndChange={onEndChange}
            isStartDisabled={isStartDisabled}
            isEndDisabled={isEndDisabled}
            showLabel={false}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="repeatSelect"
          >
            Repeat Schedule
          </label>
          <Select
            value={repeatChoice}
            onValueChange={(v: "none" | "daily" | "weekly" | "biweekly" | "monthly" | "custom") =>
              handleRepeatChange && handleRepeatChange(v)
            }
            open={openDropdown === "repeatSchedule"}
            onOpenChange={(open) =>
              setOpenDropdown?.(open ? "repeatSchedule" : null)
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
                {selectedSlot?.day ||
                  dayObj?.fullDate?.getDate() ||
                  1}
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
            value={
              repeatChoice !== "none"
                ? recurrenceEndType === "never"
                  ? "on_date"
                  : recurrenceEndType
                : ""
            }
            onValueChange={(v) =>
              setRecurrenceEndType && setRecurrenceEndType(v as "never" | "on_date" | "after_occurrences")
            }
            disabled={repeatChoice === "none"}
            open={openDropdown === "until"}
            onOpenChange={(open) =>
              setOpenDropdown?.(open ? "until" : null)
            }
          >
            <SelectTrigger
              className={`w-full ${
                repeatChoice === "none"
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              aria-label="Select how recurrence should end"
            >
              <SelectValue placeholder="Repeat Option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on_date">On date</SelectItem>
              <SelectItem value="after_occurrences">
                After occurrences
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Line 3: Repeat Section (if provided) */}
      {repeatSection && (
        <div className="space-y-4">
          {repeatSection}
        </div>
      )}

      {/* Line 4: Meeting Description */}
      <div className="space-y-2">
        <Label htmlFor="meetingDetail" className="text-sm font-medium text-foreground">
          Meeting Description <span className="text-muted-foreground">(Optional)</span>
        </Label>
        <Textarea
          id="meetingDetail"
          placeholder="Brief description of the meeting..."
          value={meetingDetail}
          onChange={(e) => setMeetingDetail(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Line 5: Applicable Model */}
      <div className="space-y-2">
        <Label htmlFor="applicableModel" className="text-sm font-medium text-foreground">
          Applicable Model <span className="text-muted-foreground">(Optional)</span>
        </Label>
        <Input
          id="applicableModel"
          placeholder="Enter applicable model..."
          value={applicableModel || ""}
          onChange={(e) => setApplicableModel && setApplicableModel(e.target.value)}
          maxLength={255}
        />
      </div>
    </div>
  );
}
