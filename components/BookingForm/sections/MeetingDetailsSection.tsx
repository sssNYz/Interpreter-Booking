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
}: MeetingDetailsSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Meeting Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div className="grid gap-2 md:col-span-1 min-w-0">
          <Label htmlFor="meetingRoom">Meeting Room *</Label>
          <Input
            id="meetingRoom"
            placeholder="meetingRoom"
            value={meetingRoom}
            onChange={(e) => setMeetingRoom(e.target.value)}
            className={errors.meetingRoom ? "border-red-500" : ""}
          />
        </div>

        <div className="grid gap-2 md:col-span-1 min-w-0">
          <Label htmlFor="meetingType">Meeting Type</Label>
          <Select
            value={meetingType ?? "none"}
            onValueChange={(v) =>
              setMeetingType && setMeetingType(v === "none" ? null : v)
            }
          >
            <SelectTrigger id="meetingType" className="w-full">
              <SelectValue placeholder="Select type (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No type</SelectItem>
              <SelectItem value="DR">DR</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="Weekly">Weekly</SelectItem>
              <SelectItem value="General">General</SelectItem>
              <SelectItem value="Augent">Augent</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 min-w-0 md:col-span-3">
          <Label>Meeting Time *</Label>
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
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="meetingDetail">Meeting Description</Label>
        <Textarea
          id="meetingDetail"
          placeholder="Brief description of the meeting..."
          value={meetingDetail}
          onChange={(e) => setMeetingDetail(e.target.value)}
          rows={3}
        />
      </div>

      {repeatSection && <div className="space-y-2">{repeatSection}</div>}
    </div>
  );
}
