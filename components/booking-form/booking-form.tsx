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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState, useEffect } from "react";
import {
  X,
  Plus,
  Calendar,
  Clock,
  Users,
  Mail,
  Phone,
  BadgeInfo,
} from "lucide-react";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type BookingFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlot?: {
    day: number;
    slot: string;
  };
  daysInMonth: {
    date: number;
    dayName: string;
    fullDate: Date;
    isPast: boolean;
  }[];
  interpreters?: {
    interpreterId: number;
    interpreterName: string;
    interpreterSurname: string;
  }[];
  rooms?: string[];
};

type OwnerGroup = "software" | "iot" | "network" | "security";

export function BookingForm({
  open,
  onOpenChange,
  selectedSlot,
  daysInMonth,
  interpreters = [],
}: BookingFormProps) {
  // Form state
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [ownerName, setOwnerName] = useState<string>("");
  const [ownerSurname, setOwnerSurname] = useState<string>("");
  const [ownerEmail, setOwnerEmail] = useState<string>("");
  const [ownerTel, setOwnerTel] = useState<string>("");
  const [ownerGroup, setOwnerGroup] = useState<OwnerGroup>("software");
  const [meetingRoom, setMeetingRoom] = useState<string>("");
  const [meetingDetail, setMeetingDetail] = useState<string>("");
  const [highPriority, setHighPriority] = useState<boolean>(false);
  const [interpreterId, setInterpreterId] = useState<string>("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState<string>("");

  // Loading and error states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Set default start time based on selected slot
  useEffect(() => {
    setStartTime(selectedSlot?.slot || "");
  }, [open, selectedSlot?.slot]);

  const dayObj = selectedSlot
    ? daysInMonth.find((d) => d.date === selectedSlot.day)
    : undefined;

  // Reset form when sheet opens/closes
  useEffect(() => {
    if (!open) {
      // Reset all form fields when sheet closes
      setStartTime("");
      setEndTime("");
      setOwnerName("");
      setOwnerSurname("");
      setOwnerEmail("");
      setOwnerTel("");
      setOwnerGroup("software");
      setMeetingRoom("");
      setMeetingDetail("");
      setHighPriority(false);
      setInterpreterId("");
      setInviteEmails([]);
      setNewEmail("");
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open]);

  // Time slots generation
  const slotsTime = useMemo(() => {
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
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Get available end times based on selected start time
  const availableEndTimes = useMemo(() => {
    if (!startTime) return slotsTime;
    const startMinutes = timeToMinutes(startTime);
    return slotsTime.filter((time) => {
      const endMinutes = timeToMinutes(time);
      return endMinutes > startMinutes;
    });
  }, [startTime, slotsTime]);

  // Reset end time if it becomes invalid
  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (endTime && timeToMinutes(endTime) <= timeToMinutes(value)) {
      setEndTime("");
    }
  };

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Email management functions
  const addInviteEmail = () => {
    if (
      newEmail &&
      isValidEmail(newEmail) &&
      !inviteEmails.includes(newEmail)
    ) {
      setInviteEmails([...inviteEmails, newEmail]);
      setNewEmail("");
    }
  };

  const removeInviteEmail = (emailToRemove: string) => {
    setInviteEmails(inviteEmails.filter((email) => email !== emailToRemove));
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!ownerName.trim()) newErrors.ownerName = "Name is required";
    if (!ownerSurname.trim()) newErrors.ownerSurname = "Surname is required";
    if (!ownerEmail.trim()) newErrors.ownerEmail = "Email is required";
    else if (!isValidEmail(ownerEmail))
      newErrors.ownerEmail = "Invalid email format";
    if (!ownerTel.trim()) newErrors.ownerTel = "Phone number is required";
    if (!meetingRoom.trim()) newErrors.meetingRoom = "Meeting room is required";
    if (!startTime) newErrors.startTime = "Start time is required";
    if (!endTime) newErrors.endTime = "End time is required";

    setErrors(newErrors);
    console.log("ERROR IS = ", newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!dayObj) return;

    setIsSubmitting(true);

    try {
      // Create the datetime strings

      const localDate = getLocalDateString(dayObj.fullDate);
      const startDateTime = `${localDate}T${startTime}:00.000`;
      const endDateTime = `${localDate}T${endTime}:00.000`;

      const bookingData = {
        ownerName: ownerName.trim(),
        ownerSurname: ownerSurname.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerTel: ownerTel.trim(),
        ownerGroup,
        meetingRoom: meetingRoom.trim(),
        meetingDetail: meetingDetail.trim() || undefined,
        highPriority,
        timeStart: startDateTime,
        timeEnd: endDateTime,
        interpreterId: interpreterId ? parseInt(interpreterId) : null,
        bookingStatus: "waiting", // Default to waiting
        inviteEmails: inviteEmails.length > 0 ? inviteEmails : undefined,
      };

      const response = await fetch("/api/booking-data/post-booking-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingData),
      });

      const result = await response.json();

      if (result.success) {
        alert("Booking created successfully!");
        onOpenChange(false);
      } else {
        alert(`Error: ${result.message || result.error}`);
        if (result.details) {
          console.error("Validation errors:", result.details);
        }
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      alert("An error occurred while creating the booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Interperter Booking Form
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Booking for:{" "}
            <strong className="text-foreground">
              {dayObj?.dayName} {selectedSlot?.day}
            </strong>
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="focus-visible:ring-ring/50 size-full rounded-3xl  transition-[color,box-shadow] overflow-auto">
          <div className="grid gap-6 py-6 px-6">
            {/* Personal Information Section */}
            <div className="space-y-4">
              {/*title*/}
              <h3 className="flex text-lg font-semibold border-b pb-2 ml-auto">
                Personal Information
              </h3>
              {/*full name */}
              <div className="grid grid-cols-2 gap-4">
                {/*first name */}
                <div className="grid gap-2">
                  <Label htmlFor="ownerName">First Name *</Label>
                  <Input
                    id="ownerName"
                    placeholder="Your first name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className={errors.ownerName ? "border-red-500" : ""}
                  />
                  {errors.ownerName && (
                    <p className="text-red-500 text-sm">{errors.ownerName}</p>
                  )}
                </div>
                {/*last name */}
                <div className="grid gap-2">
                  <Label htmlFor="ownerSurname">Last Name *</Label>
                  <Input
                    id="ownerSurname"
                    placeholder="Your last name"
                    value={ownerSurname}
                    onChange={(e) => setOwnerSurname(e.target.value)}
                    className={errors.ownerSurname ? "border-red-500" : ""}
                  />
                  {errors.ownerSurname && (
                    <p className="text-red-500 text-sm">
                      {errors.ownerSurname}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ownerEmail" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email *
                </Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  placeholder="your.email@example.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className={errors.ownerEmail ? "border-red-500" : ""}
                />
                {errors.ownerEmail && (
                  <p className="text-red-500 text-sm">{errors.ownerEmail}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ownerTel" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone *
                  </Label>
                  <Input
                    id="ownerTel"
                    placeholder="0123456789"
                    value={ownerTel}
                    onChange={(e) => setOwnerTel(e.target.value)}
                    className={errors.ownerTel ? "border-red-500" : ""}
                  />
                  {errors.ownerTel && (
                    <p className="text-red-500 text-sm">{errors.ownerTel}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ownerGroup">Department</Label>
                  <Select
                    value={ownerGroup}
                    onValueChange={(value: OwnerGroup) => setOwnerGroup(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="software">Software</SelectItem>
                      <SelectItem value="iot">IoT</SelectItem>
                      <SelectItem value="network">Network</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Meeting Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Meeting Details
              </h3>
              {/*Room and Time */}
              <div className="grid grid-cols-2 gap-4">
                {/*meeting room */}
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
                {/* Time Selection */}
                <div className="grid gap-2 justify-center">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Meeting Time *
                  </Label>
                  <div className="flex items-center gap-4">
                    <Select
                      value={startTime}
                      onValueChange={handleStartTimeChange}
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
                      value={endTime}
                      onValueChange={setEndTime}
                      disabled={!startTime}
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

              {/*Meeting Description*/}
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

            {/* Additional Options Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Additional Options
              </h3>

              <div className="flex items-center space-x-2">
                <Switch
                  id="highPriority"
                  checked={highPriority}
                  onCheckedChange={(checked) =>
                    setHighPriority(checked === true)
                  }
                />
                <Label
                  htmlFor="highPriority"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  High Priority Meeting
                  <Tooltip>
                    <TooltipTrigger>
                      <BadgeInfo className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Read Define</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
              </div>

              {interpreters.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="interpreterId">Interpreter (Optional)</Label>
                  <Select
                    value={interpreterId}
                    onValueChange={setInterpreterId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an interpreter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Interpreter</SelectItem>
                      {interpreters.map((interpreter) => (
                        <SelectItem
                          key={interpreter.interpreterId}
                          value={interpreter.interpreterId.toString()}
                        >
                          {interpreter.interpreterName}{" "}
                          {interpreter.interpreterSurname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Invite Emails Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Invite Participants
              </h3>

              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addInviteEmail()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addInviteEmail}
                  disabled={!newEmail || !isValidEmail(newEmail)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {inviteEmails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {inviteEmails.map((email, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {email}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-red-500"
                        onClick={() => removeInviteEmail(email)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        <SheetFooter className="border-t pt-4">
          <div className="flex gap-2 w-full">
            <SheetClose asChild>
              <Button variant="outline" className="flex-1">
                Cancel
              </Button>
            </SheetClose>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
              variant="default"
            >
              {isSubmitting ? "Creating..." : "Create Booking"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
