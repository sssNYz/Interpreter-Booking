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
  showLabel?: boolean;
  openDropdown?: string | null;
  setOpenDropdown?: (value: string | null) => void;
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
  showLabel = true,
  openDropdown,
  setOpenDropdown,
}: TimeRangeSelectorProps) {

  return (
    <div className="">
      {showLabel && (
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="h-4 w-4" />
          Meeting Time <span className="text-destructive">*</span>
        </Label>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <Select 
            value={startTime} 
            onValueChange={onStartChange}
            open={openDropdown === "startTime"}
            onOpenChange={(open) => setOpenDropdown?.(open ? "startTime" : null)}
          >
            <SelectTrigger 
              className={`w-full ${startTimeError ? "border-destructive focus:border-destructive" : ""}`}
              aria-label="Select start time"
              aria-describedby={startTimeError ? "start-time-error" : undefined}
            >
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
                      className={disabled ? "text-muted-foreground data-[disabled]:text-muted-foreground" : ""}
                    >
                      {time}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-center sm:px-2">
          <span className="text-muted-foreground text-sm font-medium">to</span>
        </div>

        <div className="flex-1 min-w-0">
          <Select 
            value={endTime} 
            onValueChange={onEndChange} 
            disabled={!startTime}
            open={openDropdown === "endTime"}
            onOpenChange={(open) => setOpenDropdown?.(open ? "endTime" : null)}
          >
            <SelectTrigger 
              className={`w-full ${endTimeError ? "border-destructive focus:border-destructive" : ""}`}
              aria-label="Select end time"
              aria-describedby={endTimeError ? "end-time-error" : undefined}
            >
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
                      className={disabled ? "text-muted-foreground data-[disabled]:text-muted-foreground" : ""}
                    >
                      {time}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}


