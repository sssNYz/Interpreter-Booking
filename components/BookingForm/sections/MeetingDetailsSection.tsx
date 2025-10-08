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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Presentation, Check, ChevronsUpDown } from "lucide-react";
import type { DRType } from "@/prisma/prisma";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
  location: string | null;
  capacity: number;
  isActive: boolean;
}

interface MeetingDetailsSectionProps {
  meetingRoom: string;
  setMeetingRoom: (value: string) => void;
  meetingType?: string | null;
  setMeetingType?: (value: string | null) => void;
  meetingDetail: string;
  setMeetingDetail: (value: string) => void;
  applicableModel?: string;
  setApplicableModel?: (value: string) => void;
  chairmanEmail?: string;
  setChairmanEmail?: (value: string) => void;

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
  handleRepeatChange: (
    value: "none" | "daily" | "weekly" | "biweekly" | "monthly" | "custom"
  ) => void;
  recurrenceEndType: "never" | "on_date" | "after_occurrences";
  setRecurrenceEndType: (
    value: "never" | "on_date" | "after_occurrences"
  ) => void;
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
  chairmanEmail,
  setChairmanEmail,
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomComboboxOpen, setRoomComboboxOpen] = useState(false);

  // Fetch rooms from API
  useEffect(() => {
    const fetchRooms = async () => {
      setLoadingRooms(true);
      try {
        const response = await fetch("/api/admin/add-room?isActive=true");
        const data = await response.json();
        if (data.success) {
          setRooms(data.data.rooms);
        }
      } catch (error) {
        console.error("Error fetching rooms:", error);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Presentation className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">
          Meeting Details
        </h2>
      </div>

      {/* Line 1: Meeting Room, Meeting Type, DR Type, Other Type */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label
            htmlFor="meetingRoom"
            className="text-sm font-medium text-foreground"
          >
            Meeting Room <span className="text-destructive">*</span>
          </Label>
          <Popover open={roomComboboxOpen} onOpenChange={setRoomComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={roomComboboxOpen}
                id="meetingRoom"
                className={`w-full justify-between ${
                  errors.meetingRoom
                    ? "border-destructive focus:border-destructive"
                    : ""
                }`}
                disabled={loadingRooms}
                aria-describedby={
                  errors.meetingRoom ? "meetingRoom-error" : undefined
                }
              >
                {meetingRoom
                  ? rooms.find((room) => room.name === meetingRoom)?.name
                  : loadingRooms
                  ? "Loading..."
                  : "Select room"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search rooms..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No room found.</CommandEmpty>
                  <CommandGroup>
                    {rooms.map((room) => (
                      <CommandItem
                        key={room.id}
                        value={room.name}
                        onSelect={(currentValue) => {
                          setMeetingRoom(
                            currentValue === meetingRoom ? "" : currentValue
                          );
                          setRoomComboboxOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            meetingRoom === room.name
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{room.name}</span>
                          {room.location && (
                            <span className="text-sm text-muted-foreground">
                              Floor {room.location}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="meetingType"
            className="text-sm font-medium text-foreground"
          >
            Meeting Type <span className="text-destructive">*</span>
          </Label>

          <Select
            value={meetingType ?? undefined}
            onValueChange={(v) => setMeetingType && setMeetingType(v)}
            open={openDropdown === "meetingType"}
            onOpenChange={(open) =>
              setOpenDropdown?.(open ? "meetingType" : null)
            }
          >
            <SelectTrigger
              id="meetingType"
              className={`w-full ${
                errors.meetingType
                  ? "border-destructive focus:border-destructive"
                  : ""
              }`}
              aria-describedby={
                errors.meetingType ? "meetingType-error" : undefined
              }
            >
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="President">President</SelectItem>
              <SelectItem value="DR">DR</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="Weekly">Weekly</SelectItem>
              <SelectItem value="General">General</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="drType"
            className="text-sm font-medium text-foreground"
          >
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
              className={`w-full ${
                errors.drType
                  ? "border-destructive focus:border-destructive"
                  : ""
              } ${meetingType !== "DR" ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-describedby={errors.drType ? "drType-error" : undefined}
            >
              <SelectValue placeholder="Select DR type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DR_PR">DR-PR</SelectItem>
              <SelectItem value="DR_k">DR-k</SelectItem>
              <SelectItem value="DR_II">DR-II</SelectItem>
              <SelectItem value="DR_I">DR-I</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="otherType"
            className="text-sm font-medium text-foreground"
          >
            Other Type
          </Label>
          <Input
            id="otherType"
            placeholder={
              meetingType === "DR"
                ? "Describe DR type..."
                : "Describe meeting type..."
            }
            value={otherType || ""}
            onChange={(e) => setOtherType && setOtherType(e.target.value)}
            className={`${
              errors.otherType
                ? "border-destructive focus:border-destructive"
                : ""
            } ${
              (meetingType === "DR" && drType === "Other") ||
              meetingType === "Other"
                ? ""
                : "opacity-50 cursor-not-allowed"
            }`}
            aria-describedby={errors.otherType ? "otherType-error" : undefined}
            maxLength={255}
            disabled={
              !(
                (meetingType === "DR" && drType === "Other") ||
                meetingType === "Other"
              )
            }
          />
        </div>
      </div>

      {/* Line 2: Meeting Time, Repeat Schedule, Until... */}
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4 items-start">
        <div className="space-y-1">
          <Label
            className="text-sm font-medium text-foreground"
            htmlFor="meeting-time"
          >
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
            onValueChange={(
              v: "none" | "daily" | "weekly" | "biweekly" | "monthly" | "custom"
            ) => handleRepeatChange && handleRepeatChange(v)}
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
                {selectedSlot?.day || dayObj?.fullDate?.getDate() || 1}
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
              setRecurrenceEndType &&
              setRecurrenceEndType(
                v as "never" | "on_date" | "after_occurrences"
              )
            }
            disabled={repeatChoice === "none"}
            open={openDropdown === "until"}
            onOpenChange={(open) => setOpenDropdown?.(open ? "until" : null)}
          >
            <SelectTrigger
              className={`w-full ${
                repeatChoice === "none" ? "opacity-50 cursor-not-allowed" : ""
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
      {repeatSection && <div className="space-y-4">{repeatSection}</div>}

      {/* Chairman Email (DR only) before Meeting Description */}
      {meetingType === "DR" && (
        <div className="space-y-2">
          <Label
            htmlFor="chairmanEmail"
            className="text-sm font-medium text-foreground"
          >
            Chairman Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="chairmanEmail"
            type="email"
            placeholder="chairman@company.com"
            value={chairmanEmail || ""}
            onChange={(e) => setChairmanEmail && setChairmanEmail(e.target.value)}
            className={`${errors.chairmanEmail ? "border-destructive focus:border-destructive" : ""}`}
            aria-describedby={errors.chairmanEmail ? "chairmanEmail-error" : undefined}
          />
          {errors.chairmanEmail && (
            <p id="chairmanEmail-error" className="text-sm text-destructive">
              {errors.chairmanEmail}
            </p>
          )}
        </div>
      )}

      {/* Line 4: Meeting Description */}
      <div className="space-y-2">
        <Label
          htmlFor="meetingDetail"
          className="text-sm font-medium text-foreground"
        >
          Meeting Description{" "}
          <span className="text-muted-foreground">(Optional)</span>
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
        <Label
          htmlFor="applicableModel"
          className="text-sm font-medium text-foreground"
        >
          Applicable Model{" "}
          <span className="text-muted-foreground">(Optional)</span>
        </Label>
        <Input
          id="applicableModel"
          placeholder="Enter applicable model..."
          value={applicableModel || ""}
          onChange={(e) =>
            setApplicableModel && setApplicableModel(e.target.value)
          }
          maxLength={255}
        />
      </div>
    </div>
  );
}
