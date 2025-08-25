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

interface MeetingDetailsSectionProps {
  meetingRoom: string;
  setMeetingRoom: (value: string) => void;
  meetingType?: string | null;
  setMeetingType?: (value: string | null) => void;
  meetingDetail: string;
  setMeetingDetail: (value: string) => void;

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
}

export function MeetingDetailsSection({
  meetingRoom,
  setMeetingRoom,
  meetingType,
  setMeetingType,
  meetingDetail,
  setMeetingDetail,
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
}: MeetingDetailsSectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3">
        Meeting Details
      </h2>

      {/* Line 1: Meeting Room, Meeting Type, Meeting Time */}
      <div className="grid grid-cols-1 sm:grid-cols-[0.5fr_0.5fr_1fr] gap-4">
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
          {errors.meetingRoom && (
            <p id="meetingRoom-error" className="text-destructive text-sm" role="alert">
              {errors.meetingRoom}
            </p>
          )}
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
          {errors.meetingType && (
            <p id="meetingType-error" className="text-destructive text-sm" role="alert">
              {errors.meetingType}
            </p>
          )}
        </div>

        <div className="space-y-2">
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
          {(errors.startTime || errors.endTime) && (
            <p className="text-destructive text-sm" role="alert">
              {errors.startTime || errors.endTime}
            </p>
          )}
        </div>
      </div>

      {/* Line 2, 3, 4: Repeat Section (if provided) */}
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
    </div>
  );
}
