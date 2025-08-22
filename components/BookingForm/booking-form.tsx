import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState, useEffect } from "react";
import { generateStandardTimeSlots, generateEndTimeSlots, timeToMinutes, formatYmdFromDate, buildDateTimeString, isValidStartTime, isValidTimeRange } from "@/utils/time";
import { Calendar, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import type { OwnerGroup } from "@/types/booking";
import type { BookingFormProps } from "@/types/props";
import { PersonalInfoSection } from "@/components/BookingForm/sections/PersonalInfoSection";
import { MeetingDetailsSection } from "@/components/BookingForm/sections/MeetingDetailsSection";
import { AdditionalOptionsSection } from "@/components/BookingForm/sections/AdditionalOptionsSection";
import { InviteEmailsSection } from "@/components/BookingForm/sections/InviteEmailsSection";
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


  // Get user data from localStorage (cached at login) and reset form when sheet opens/closes
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
    if (open) {
      try {
        const raw = localStorage.getItem("booking.user");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        // Session is now enforced by server cookie; just read profile if present
        const full = String(parsed.name || "");
        const parts = full.trim().split(/\s+/);
        const first = parts[0] || "";
        const last = parts.slice(1).join(" ") || "";
        setOwnerName(first);
        setOwnerSurname(last);
        setOwnerEmail(parsed.email || "");
        setOwnerTel(parsed.phone || "");
      } catch {}
    }
  }, [open]);

  // Time slots generation (unified)
  const slotsTime = useMemo(() => generateStandardTimeSlots(), []);

  // timeToMinutes unified from utils/time

  // Get available end times based on selected start time
  const availableEndTimes = useMemo(() => {
    if (!startTime) return generateEndTimeSlots();
    const endSlots = generateEndTimeSlots();
    const startMinutes = timeToMinutes(startTime);
    return endSlots.filter((time) => timeToMinutes(time) > startMinutes);
  }, [startTime]);


  // Reset end time if it becomes invalid
  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (endTime && timeToMinutes(endTime) <= timeToMinutes(value)) {
      setEndTime("");
    }
  };

  const getLocalDateString = (date: Date) => formatYmdFromDate(date);

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

    if (!meetingRoom.trim()) newErrors.meetingRoom = "Meeting room is required";
    if (!startTime) newErrors.startTime = "Start time is required";
    if (!endTime) newErrors.endTime = "End time is required";
    if (startTime && !isValidStartTime(startTime)) newErrors.startTime = "Invalid start time";
    if (startTime && endTime && !isValidTimeRange(startTime, endTime)) newErrors.endTime = "End must be after start";

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
      // Create the datetime strings (plain strings YYYY-MM-DD HH:mm:ss)
      const localDate = getLocalDateString(dayObj.fullDate);
      const startDateTime = buildDateTimeString(localDate, startTime);
      const endDateTime = buildDateTimeString(localDate, endTime);

      // Get empCode from localStorage
      const raw = localStorage.getItem("booking.user");
      if (!raw) {
        alert("User session expired. Please login again.");
        return;
      }
      const parsed = JSON.parse(raw);
      const empCode = parsed.empCode;
      if (!empCode) {
        alert("User session invalid. Please login again.");
        return;
      }

      const bookingData = {
        ownerEmpCode: empCode,
        ownerGroup,
        meetingRoom: meetingRoom.trim(),
        meetingDetail: meetingDetail.trim() || undefined,
        highPriority,
        timeStart: startDateTime,
        timeEnd: endDateTime,
        bookingStatus: "waiting", // Default to waiting
        inviteEmails: inviteEmails.length > 0 ? inviteEmails : undefined,
      };

      const submitOnce = async (force?: boolean) => {
      const response = await fetch("/api/booking-data/post-booking-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
          body: JSON.stringify({ ...bookingData, ...(force ? { force: true } : {}) }),
        });
        const result = await response.json();
        return { response, result } as const;
      };

      // First attempt without force
      let { response, result } = await submitOnce(false);

      // If overlap warning, show themed confirm toast and then force submit on OK
      if (response.status === 409 && result?.code === "OVERLAP_WARNING") {
        const proceed = await new Promise<boolean>((resolve) => {
          toast.custom(
            (t) => (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-[420px]">
                <Alert className="border-none p-0">
                  <AlertTitle className="text-gray-900">
                    <span className="text-amber-600 font-semibold">Same room warning</span>
                    <span className="ml-1">
                      {result?.message || "This room already has a booking overlapping this time."}
                    </span>
                  </AlertTitle>
                  <AlertDescription className="text-gray-700">
                    Do you want to continue?
                  </AlertDescription>
                </Alert>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      toast.dismiss(t);
                      resolve(false);
                    }}
                    className="bg-gray-200 text-gray-900 px-3 py-1 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      toast.dismiss(t);
                      resolve(true);
                    }}
                    className="bg-gray-900 text-white px-3 py-1 rounded text-xs"
                  >
                    OK
                  </button>
                </div>
              </div>
            ),
            { duration: 10000 }
          );
        });

        if (proceed) {
          ({ response, result } = await submitOnce(true));
        } else {
          return; // user cancelled
        }
      }

      if (result.success) {
        const bookingDate = dayObj?.fullDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const duration = `${startTime} - ${endTime}`;
        toast.custom(
          (t) => (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-[420px]">
              <Alert className="border-none p-0">
                <AlertTitle className="text-gray-900">
                  <span className="text-green-600 font-semibold">Success</span>
                  <span className="ml-1">Booking created successfully!</span>
                </AlertTitle>
                <AlertDescription className="text-gray-700">
                  {bookingDate} at {duration}
                </AlertDescription>
              </Alert>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => toast.dismiss(t)}
                  className="bg-gray-900 text-white px-3 py-1 rounded text-xs"
                >
                  OK
                </button>
              </div>
            </div>
          ),
          { duration: 5000 }
        );
        // Close the form
        onOpenChange(false);
        // Notify other components that bookings have changed
        try {
          window.dispatchEvent(new CustomEvent("booking:updated"));
        } catch {}
      } else {
        toast.custom(
          (t) => (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-[420px]">
              <Alert className="border-none p-0">
                <AlertTitle className="text-gray-900">
                  <span className="text-red-600 font-semibold">Error</span>
                  <span className="ml-1">Unable to create booking</span>
                </AlertTitle>
                <AlertDescription className="text-gray-700">
                  {result.message || result.error || "Please try again"}
                </AlertDescription>
              </Alert>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => toast.dismiss(t)}
                  className="bg-gray-900 text-white px-3 py-1 rounded text-xs"
                >
                  OK
                </button>
              </div>
            </div>
          ),
          { duration: 5000 }
        );
        if (result.details) {
          console.error("Validation errors:", result.details);
        }
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.custom(
        (t) => (
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-[420px]">
            <Alert className="border-none p-0">
              <AlertTitle className="text-gray-900">
                <span className="text-red-600 font-semibold">Error</span>
                <span className="ml-1">Unable to create booking</span>
              </AlertTitle>
              <AlertDescription className="text-gray-700">
                An error occurred while creating the booking
              </AlertDescription>
            </Alert>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => toast.dismiss(t)}
                className="bg-gray-900 text-white px-3 py-1 rounded text-xs"
              >
                OK
              </button>
            </div>
          </div>
        ),
        { duration: 5000 }
      );
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
            <PersonalInfoSection
              ownerName={ownerName}
              ownerSurname={ownerSurname}
              ownerEmail={ownerEmail}
              ownerTel={ownerTel}
              ownerGroup={ownerGroup}
              errors={errors}
              onGroupChange={setOwnerGroup}
            />

            <MeetingDetailsSection
              meetingRoom={meetingRoom}
              setMeetingRoom={(v) => setMeetingRoom(v)}
              meetingDetail={meetingDetail}
              setMeetingDetail={(v) => setMeetingDetail(v)}
              startTime={startTime}
              endTime={endTime}
              slotsTime={slotsTime}
              availableEndTimes={availableEndTimes}
              errors={errors}
              onStartChange={handleStartTimeChange}
              onEndChange={setEndTime}
            />

            <AdditionalOptionsSection
              highPriority={highPriority}
              setHighPriority={(v) => setHighPriority(v)}
              interpreterId={interpreterId}
              setInterpreterId={(v) => setInterpreterId(v)}
              interpreters={interpreters}
            />

            <InviteEmailsSection
              inviteEmails={inviteEmails}
              newEmail={newEmail}
              setNewEmail={(v) => setNewEmail(v)}
              addInviteEmail={addInviteEmail}
              removeInviteEmail={removeInviteEmail}
              isValidEmail={isValidEmail}
            />
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

