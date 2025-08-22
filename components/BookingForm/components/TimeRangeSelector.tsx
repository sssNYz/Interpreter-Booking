import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";

interface TimeRangeSelectorProps {
  startTime: string;
  endTime: string;
  slotsTime: string[];
  availableEndTimes: string[];
  startTimeError?: string;
  endTimeError?: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  isStartDisabled?: (t: string) => boolean;
  isEndDisabled?: (t: string) => boolean;
}

export function TimeRangeSelector({
  startTime,
  endTime,
  slotsTime,
  availableEndTimes,
  startTimeError,
  endTimeError,
  onStartChange,
  onEndChange,
  isStartDisabled,
  isEndDisabled,
}: TimeRangeSelectorProps) {
  const hasError = Boolean(startTimeError || endTimeError);

  return (
    <div className="grid gap-2 justify-center">
      <Label className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Meeting Time *
      </Label>
      <div className="flex items-center gap-4">
        <Select value={startTime} onValueChange={onStartChange}>
          <SelectTrigger className={`w-[135px] ${startTimeError ? "border-red-500" : ""}`}>
            <SelectValue placeholder="Start Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Start Time</SelectLabel>
              {slotsTime.map((time) => {
                const disabled = isStartDisabled?.(time);
                return (
                  <SelectItem 
                    key={time} 
                    value={time} 
                    disabled={disabled}
                    className={disabled ? "text-neutral-500 data-[disabled]:text-neutral-500" : ""}
                  >
                    {time}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>

        <span className="text-muted-foreground">to</span>

        <Select value={endTime} onValueChange={onEndChange} disabled={!startTime}>
          <SelectTrigger className={`w-[135px] ${endTimeError ? "border-red-500" : ""}`}>
            <SelectValue placeholder="End Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>End Time</SelectLabel>
              {availableEndTimes.map((time) => {
                const disabled = isEndDisabled?.(time);
                return (
                  <SelectItem 
                    key={time} 
                    value={time} 
                    disabled={disabled}
                    className={disabled ? "text-neutral-500 data-[disabled]:text-neutral-500" : ""}
                  >
                    {time}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {hasError && (
        <p className="text-red-500 text-sm">{startTimeError || endTimeError}</p>
      )}
    </div>
  );
}


