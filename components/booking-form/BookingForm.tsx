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
import { Calendar, Clock } from "lucide-react";
import { useBookingForm } from "./hooks/useBookingForm";
import { PersonalInformationSection } from "./components/PersonalInformationSection";
import { MeetingDetailsSection } from "./components/MeetingDetailsSection";
import { AdditionalOptionsSection } from "./components/AdditionalOptionsSection";
import { InviteParticipantsSection } from "./components/InviteParticipantsSection";
import { createBookingData } from "./utils/bookingUtils";
import { BookingFormProps } from "./types";

export function BookingForm({
  open,
  onOpenChange,
  selectedSlot,
  daysInMonth,
  interpreters = [],
}: BookingFormProps) {
  const {
    formData,
    updateField,
    isSubmitting,
    setIsSubmitting,
    errors,
    slotsTime,
    availableEndTimes,
    addInviteEmail,
    removeInviteEmail,
    validateForm,
    isValidEmail,
  } = useBookingForm(open, selectedSlot);

  const dayObj = selectedSlot
    ? daysInMonth.find((d) => d.date === selectedSlot.day)
    : undefined;

  // Form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!dayObj) return;

    setIsSubmitting(true);

    try {
      const bookingData = createBookingData(
        formData,
        dayObj,
        formData.startTime,
        formData.endTime
      );

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

        <ScrollArea className="focus-visible:ring-ring/50 size-full rounded-3xl transition-[color,box-shadow] overflow-auto">
          <div className="grid gap-6 py-6 px-6">
            <PersonalInformationSection
              formData={formData}
              updateField={updateField}
              errors={errors}
            />

            <MeetingDetailsSection
              formData={formData}
              updateField={updateField}
              errors={errors}
              slotsTime={slotsTime}
              availableEndTimes={availableEndTimes}
            />

            <AdditionalOptionsSection
              formData={formData}
              updateField={updateField}
              interpreters={interpreters}
            />

            <InviteParticipantsSection
              formData={formData}
              updateField={updateField}
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
