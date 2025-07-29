import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo, useState, useEffect } from "react";

type BookingFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlot?: {
    day: string;
    slot: string;
  };
};

export function BookingForm({
  open,
  onOpenChange,
  selectedSlot,
}: BookingFormProps) {
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [room, setRoom] = useState<string>("");

  // Reset form when sheet opens/closes
  useEffect(() => {
    if (!open) {
      // Reset all form fields when sheet closes
      setStartTime("");
      setEndTime("");
      setName("");
      setRoom("");
    }
  }, [open]);
  
  const slots = useMemo(() => {
    const times = [];
    for (let hour = 8; hour < 18; hour++) {
      if (hour === 12) {
        times.push(`${hour}:00`, `${hour}:20`);
        continue;
      }
      if (hour === 13) {
        times.push(`${hour}:10`, `${hour}:30`);
        continue;
      }
      if (hour === 17) {
        times.push(`${hour}:00`);
        continue;
      }
      times.push(`${hour.toString().padStart(2, "0")}:00`);
      times.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return times;
  }, []);

  // Function to convert time string to minutes for comparison
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Get available end times based on selected start time
  const availableEndTimes = useMemo(() => {
    if (!startTime) return slots;
    
    const startMinutes = timeToMinutes(startTime);
    return slots.filter(time => {
      const endMinutes = timeToMinutes(time);
      return endMinutes > startMinutes;
    });
  }, [startTime, slots]);

  // Reset end time if it becomes invalid
  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (endTime && timeToMinutes(endTime) <= timeToMinutes(value)) {
      setEndTime("");
    }
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Book Time Slot</SheetTitle>
          <SheetDescription>
            Booking for:{" "}
            <strong>
              {selectedSlot?.day} @ {selectedSlot?.slot}
            </strong>
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4 py-2">
          <div className="grid gap-3">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              placeholder="Your name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-3">
            <Label htmlFor="room">Room</Label>
            <Input 
              id="room" 
              placeholder="Meeting Room" 
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>

          <div className="flex flex-col items-center gap-3">
            <Label htmlFor="room" className="gap-6 mr-auto">
              Set Time
            </Label>

            <div className="flex justify-center items-center overflow-x-auto space-x-5">
              <Select value={startTime} onValueChange={handleStartTimeChange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Time Start" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Start Time</SelectLabel>
                    {slots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <div>To</div>

              <Select value={endTime} onValueChange={setEndTime} disabled={!startTime}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Time End" />
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
          </div>
        </div>
        <SheetFooter className="mt-4">
          <Button type="submit" variant="sunnyStyle">
            Save
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}