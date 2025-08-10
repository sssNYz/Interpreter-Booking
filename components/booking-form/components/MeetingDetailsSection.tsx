import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock } from "lucide-react";
import { FormData } from "../types";

type MeetingDetailsSectionProps = {
  formData: FormData;
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  errors: Record<string, string>;
  slotsTime: string[];
  availableEndTimes: string[];
};

export function MeetingDetailsSection({
  formData,
  updateField,
  errors,
  slotsTime,
  availableEndTimes,
}: MeetingDetailsSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Meeting Details</h3>

      {/* Room and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="meetingRoom">Meeting Room *</Label>
          <Input
            id="meetingRoom"
            placeholder="meetingRoom"
            value={formData.meetingRoom}
            onChange={(e) => updateField("meetingRoom", e.target.value)}
            className={errors.meetingRoom ? "border-red-500" : ""}
          />
        </div>

        {/* Time Selection */}
        <div className="grid gap-2 justify-center">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Meeting Time *
          </Label>
          <div className="flex items-center gap-4">
            <Select
              value={formData.startTime}
              onValueChange={(value) => updateField("startTime", value)}
            >
              <SelectTrigger
                className={`w-[135px] ${
                  errors.startTime ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="Start Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Start Time</SelectLabel>
                  {slotsTime.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">to</span>

            <Select
              value={formData.endTime}
              onValueChange={(value) => updateField("endTime", value)}
              disabled={!formData.startTime}
            >
              <SelectTrigger
                className={`w-[135px] ${
                  errors.endTime ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="End Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>End Time</SelectLabel>
                  {availableEndTimes.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {(errors.startTime || errors.endTime) && (
            <p className="text-red-500 text-sm">
              {errors.startTime || errors.endTime}
            </p>
          )}
        </div>
      </div>

      {/* Meeting Description */}
      <div className="grid gap-2">
        <Label htmlFor="meetingDetail">Meeting Description</Label>
        <Textarea
          id="meetingDetail"
          placeholder="Brief description of the meeting..."
          value={formData.meetingDetail}
          onChange={(e) => updateField("meetingDetail", e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
