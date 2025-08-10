import { useState, useEffect, useMemo } from "react";
import { FormData, OwnerGroup } from "../types";

export function useBookingForm(
  open: boolean,
  selectedSlot?: { day: number; slot: string }
) {
  // Form state
  const [formData, setFormData] = useState<FormData>({
    startTime: "",
    endTime: "",
    ownerName: "",
    ownerSurname: "",
    ownerEmail: "",
    ownerTel: "",
    ownerGroup: "software",
    meetingRoom: "",
    meetingDetail: "",
    highPriority: false,
    interpreterId: "",
    inviteEmails: [],
    newEmail: "",
  });

  // Loading and error states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Set default start time based on selected slot
  useEffect(() => {
    if (selectedSlot?.slot) {
      setFormData((prev) => ({ ...prev, startTime: selectedSlot.slot }));
    }
  }, [open, selectedSlot?.slot]);

  // Reset form when sheet opens/closes
  useEffect(() => {
    if (!open) {
      setFormData({
        startTime: "",
        endTime: "",
        ownerName: "",
        ownerSurname: "",
        ownerEmail: "",
        ownerTel: "",
        ownerGroup: "software",
        meetingRoom: "",
        meetingDetail: "",
        highPriority: false,
        interpreterId: "",
        inviteEmails: [],
        newEmail: "",
      });
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
    if (!formData.startTime) return slotsTime;
    const startMinutes = timeToMinutes(formData.startTime);
    return slotsTime.filter((time) => {
      const endMinutes = timeToMinutes(time);
      return endMinutes > startMinutes;
    });
  }, [formData.startTime, slotsTime]);

  // Update form field
  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Reset end time if start time becomes invalid
    if (
      field === "startTime" &&
      formData.endTime &&
      typeof value === "string"
    ) {
      if (timeToMinutes(value) >= timeToMinutes(formData.endTime)) {
        setFormData((prev) => ({ ...prev, endTime: "" }));
      }
    }
  };

  // Email management functions
  const addInviteEmail = () => {
    if (
      formData.newEmail &&
      isValidEmail(formData.newEmail) &&
      !formData.inviteEmails.includes(formData.newEmail)
    ) {
      setFormData((prev) => ({
        ...prev,
        inviteEmails: [...prev.inviteEmails, prev.newEmail],
        newEmail: "",
      }));
    }
  };

  const removeInviteEmail = (emailToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      inviteEmails: prev.inviteEmails.filter(
        (email) => email !== emailToRemove
      ),
    }));
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.ownerName.trim()) newErrors.ownerName = "Name is required";
    if (!formData.ownerSurname.trim())
      newErrors.ownerSurname = "Surname is required";
    if (!formData.ownerEmail.trim()) newErrors.ownerEmail = "Email is required";
    else if (!isValidEmail(formData.ownerEmail))
      newErrors.ownerEmail = "Invalid email format";
    if (!formData.ownerTel.trim())
      newErrors.ownerTel = "Phone number is required";
    if (!formData.meetingRoom.trim())
      newErrors.meetingRoom = "Meeting room is required";
    if (!formData.startTime) newErrors.startTime = "Start time is required";
    if (!formData.endTime) newErrors.endTime = "End time is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return {
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
  };
}
