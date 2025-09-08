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
import { generateStandardTimeSlots, generateEndTimeSlots, timeToMinutes, formatYmdFromDate, buildDateTimeString } from "@/utils/time";
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
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { BookingFormProps } from "@/types/props";
import type { BookingFormState } from "@/types/booking-form";
import { DEFAULT_FORM_STATE, OWNER_GROUP_OPTIONS } from "@/types/booking-form";
import {
  isValidEmail,
  validateBookingForm,
  parseUserProfile,
  getDefaultFormState,
  showBookingToast,
  createBookingSubmissionData,
  addInviteEmail,
  removeInviteEmail,
  formatBookingDate,
  formatBookingDuration,
} from "@/utils/booking-form";
export function BookingForm({
  open,
  onOpenChange,
  selectedSlot,
  daysInMonth,
  interpreters = [],
}: BookingFormProps) {
  const [formState, setFormState] = useState<BookingFormState>(DEFAULT_FORM_STATE);
  const [availableInterpreters, setAvailableInterpreters] = useState<{
    interpreterId: number;
    interpreterName: string;
    interpreterSurname: string;
  }[]>(interpreters);

  useEffect(() => {
    setFormState(prev => ({ ...prev, startTime: selectedSlot?.slot || "" }));
  }, [open, selectedSlot?.slot]);

  const dayObj = selectedSlot
    ? daysInMonth.find((d) => d.date === selectedSlot.day)
    : undefined;

  useEffect(() => {
    if (!open) {
      setFormState(getDefaultFormState() as BookingFormState);
    }
    if (open) {
      const userProfile = parseUserProfile();
      if (userProfile) {
        const parts = userProfile.name.trim().split(/\s+/);
        const first = parts[0] || "";
        const last = parts.slice(1).join(" ") || "";
        setFormState(prev => ({
          ...prev,
          ownerName: first,
          ownerSurname: last,
          ownerEmail: userProfile.email,
          ownerTel: userProfile.phone,
        }));
      }
    }
  }, [open]);

  // Fetch interpreters if not provided as props
  useEffect(() => {
    if (open && interpreters.length === 0) {
      const fetchInterpreters = async () => {
        try {
          const response = await fetch('/api/employees/get-employees?role=INTERPRETER&pageSize=100');
          if (response.ok) {
            const data = await response.json();
            const interpreterList = data.users.map((user: { id: number; firstNameEn?: string; firstNameTh?: string; lastNameEn?: string; lastNameTh?: string }) => ({
              interpreterId: user.id,
              interpreterName: user.firstNameEn || user.firstNameTh || '',
              interpreterSurname: user.lastNameEn || user.lastNameTh || '',
            }));
            setAvailableInterpreters(interpreterList);
          }
        } catch (error) {
          console.error('Failed to fetch interpreters:', error);
        }
      };
      fetchInterpreters();
    } else if (interpreters.length > 0) {
      setAvailableInterpreters(interpreters);
    }
  }, [open, interpreters]);

  const slotsTime = useMemo(() => generateStandardTimeSlots(), []);
  const availableEndTimes = useMemo(() => {
    if (!formState.startTime) return generateEndTimeSlots();
    const endSlots = generateEndTimeSlots();
    const startMinutes = timeToMinutes(formState.startTime);
    return endSlots.filter((time) => timeToMinutes(time) > startMinutes);
  }, [formState.startTime]);

  const handleStartTimeChange = (value: string) => {
    setFormState(prev => ({
      ...prev,
      startTime: value,
      endTime: prev.endTime && timeToMinutes(prev.endTime) <= timeToMinutes(value) ? "" : prev.endTime,
    }));
  };

  const getLocalDateString = (date: Date) => formatYmdFromDate(date);

  const handleAddInviteEmail = () => {
    addInviteEmail(
      formState.newEmail,
      formState.inviteEmails,
      (emails) => setFormState(prev => ({ ...prev, inviteEmails: emails })),
      (email) => setFormState(prev => ({ ...prev, newEmail: email }))
    );
  };

  const handleRemoveInviteEmail = (emailToRemove: string) => {
    removeInviteEmail(
      emailToRemove,
      formState.inviteEmails,
      (emails) => setFormState(prev => ({ ...prev, inviteEmails: emails }))
    );
  };

  const validateForm = (): boolean => {
    const newErrors = validateBookingForm(formState);
    setFormState(prev => ({ ...prev, errors: newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!dayObj) return;

    setFormState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const localDate = getLocalDateString(dayObj.fullDate);
      const startDateTime = buildDateTimeString(localDate, formState.startTime);
      const endDateTime = buildDateTimeString(localDate, formState.endTime);

      const userProfile = parseUserProfile();
      if (!userProfile?.empCode) {
        alert("User session expired. Please login again.");
        return;
      }

      const bookingData = createBookingSubmissionData(
        userProfile,
        formState,
        startDateTime,
        endDateTime
      );

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
             (t: string | number) => (
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
        const bookingDate = formatBookingDate(dayObj.fullDate);
        const duration = formatBookingDuration(formState.startTime, formState.endTime);
        showBookingToast({
          title: "Success",
          description: `Booking created successfully! ${bookingDate} at ${duration}`,
          type: "success"
        });
        // Close the form
        onOpenChange(false);
        // Notify other components that bookings have changed
        try {
          window.dispatchEvent(new CustomEvent("booking:updated"));
        } catch {}
      } else {
        showBookingToast({
          title: "Error",
          description: result.message || result.error || "Unable to create booking. Please try again.",
          type: "error"
        });
        if (result.details) {
          console.error("Validation errors:", result.details);
        }
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      showBookingToast({
        title: "Error",
        description: "An error occurred while creating the booking",
        type: "error"
      });
    } finally {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
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
            <div className="space-y-4">
              <h3 className="flex text-lg font-semibold border-b pb-2 ml-auto">
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ownerName">First Name *</Label>
                  <Input
                    id="ownerName"
                    placeholder="Your first name"
                    value={formState.ownerName}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  {formState.errors.ownerName && (
                    <p className="text-red-500 text-sm">{formState.errors.ownerName}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ownerSurname">Last Name *</Label>
                  <Input
                    id="ownerSurname"
                    placeholder="Your last name"
                    value={formState.ownerSurname}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  {formState.errors.ownerSurname && (
                    <p className="text-red-500 text-sm">
                      {formState.errors.ownerSurname}
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
                  value={formState.ownerEmail}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
                {formState.errors.ownerEmail && (
                  <p className="text-red-500 text-sm">{formState.errors.ownerEmail}</p>
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
                    value={formState.ownerTel}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  {formState.errors.ownerTel && (
                    <p className="text-red-500 text-sm">{formState.errors.ownerTel}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ownerGroup">Department</Label>
                                      <Select
                      value={formState.ownerGroup}
                      onValueChange={(value) => setFormState(prev => ({ ...prev, ownerGroup: value as "software" | "iot" | "hardware" | "other" }))}
                    >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OWNER_GROUP_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Meeting Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="meetingRoom">Meeting Room *</Label>
                  <Input
                    id="meetingRoom"
                    placeholder="meetingRoom"
                    value={formState.meetingRoom}
                    onChange={(e) => setFormState(prev => ({ ...prev, meetingRoom: e.target.value }))}
                    className={formState.errors.meetingRoom ? "border-red-500" : ""}
                  />
                </div>
                <div className="grid gap-2 justify-center">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Meeting Time *
                  </Label>
                  <div className="flex items-center gap-4">
                    <Select
                      value={formState.startTime}
                      onValueChange={handleStartTimeChange}
                    >
                      <SelectTrigger
                        className={`w-[135px] ${
                          formState.errors.startTime ? "border-red-500" : ""
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
                      value={formState.endTime}
                      onValueChange={(value) => setFormState(prev => ({ ...prev, endTime: value }))}
                      disabled={!formState.startTime}
                    >
                      <SelectTrigger
                        className={`w-[135px] ${
                          formState.errors.endTime ? "border-red-500" : ""
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
                  {(formState.errors.startTime || formState.errors.endTime) && (
                    <p className="text-red-500 text-sm">
                      {formState.errors.startTime || formState.errors.endTime}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meetingDetail">Meeting Description</Label>
                                  <Textarea
                    id="meetingDetail"
                    placeholder="Brief description of the meeting..."
                    value={formState.meetingDetail}
                    onChange={(e) => setFormState(prev => ({ ...prev, meetingDetail: e.target.value }))}
                    rows={3}
                  />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Additional Options
              </h3>

              <div className="flex items-center space-x-2">
                                  <Switch
                    id="highPriority"
                    checked={formState.highPriority}
                    onCheckedChange={(checked) =>
                      setFormState(prev => ({ ...prev, highPriority: checked === true }))
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

              {availableInterpreters.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="interpreterId">Interpreter (Optional)</Label>
                                      <Select
                      value={formState.interpreterId}
                      onValueChange={(value) => setFormState(prev => ({ ...prev, interpreterId: value }))}
                    >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an interpreter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Interpreter</SelectItem>
                      {availableInterpreters.map((interpreter) => (
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

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Invite Participants
              </h3>

              <div className="flex gap-2">
                                  <Input
                    placeholder="email@example.com"
                    value={formState.newEmail}
                    onChange={(e) => setFormState(prev => ({ ...prev, newEmail: e.target.value }))}
                    onKeyPress={(e) => e.key === "Enter" && handleAddInviteEmail()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddInviteEmail}
                    disabled={!formState.newEmail || !isValidEmail(formState.newEmail)}
                  >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {formState.inviteEmails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formState.inviteEmails.map((email, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {email}
                                              <X
                          className="h-3 w-3 cursor-pointer hover:text-red-500"
                          onClick={() => handleRemoveInviteEmail(email)}
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
              disabled={formState.isSubmitting}
              className="flex-1"
              variant="default"
            >
              {formState.isSubmitting ? "Creating..." : "Create Booking"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

}

