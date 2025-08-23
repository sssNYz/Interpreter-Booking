import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeRangeSelector } from "@/components/BookingForm/components/TimeRangeSelector";

interface MeetingDetailsSectionProps {
  meetingRoom: string;
  setMeetingRoom: (value: string) => void;
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
}

export function MeetingDetailsSection({
  meetingRoom,
  setMeetingRoom,
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
}: MeetingDetailsSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Meeting Details</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="meetingRoom">Meeting Room *</Label>
          <Input
            id="meetingRoom"
            placeholder="meetingRoom"
            value={meetingRoom}
            onChange={(e) => setMeetingRoom(e.target.value)}
            className={errors.meetingRoom ? "border-red-500" : ""}
          />
        </div>

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
    </div>
  );
}


