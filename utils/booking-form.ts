import { toast } from "sonner";
import type { BookingFormState, ToastConfig, UserProfile, BookingSubmissionData } from "@/types/booking-form";

// Email validation
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Form validation
export const validateBookingForm = (formState: BookingFormState): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!formState.meetingRoom.trim()) {
    errors.meetingRoom = "Meeting room is required";
  }
  if (!formState.startTime) {
    errors.startTime = "Start time is required";
  }
  if (!formState.endTime) {
    errors.endTime = "End time is required";
  }

  return errors;
};

// User profile parsing from localStorage
export const parseUserProfile = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem("booking.user");
    if (!raw) return null;
    
    const parsed = JSON.parse(raw);
    const full = String(parsed.name || "").trim();
    
    return {
      name: full,
      email: parsed.email || "",
      phone: parsed.phone || "",
      empCode: parsed.empCode || "",
    };
  } catch {
    return null;
  }
};

// Form reset helper
export const getDefaultFormState = (): Partial<BookingFormState> => ({
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
  interpreterId: "none",
  inviteEmails: [],
  newEmail: "",
  errors: {},
  isSubmitting: false,
});

// Toast notification helper
export const showBookingToast = (config: ToastConfig) => {
  if (config.type === "success") {
    toast.success(config.title, { description: config.description });
  } else if (config.type === "error") {
    toast.error(config.title, { description: config.description });
  } else {
    toast.warning(config.title, { description: config.description });
  }
};

// Booking submission helper
export const createBookingSubmissionData = (
  userProfile: UserProfile,
  formState: BookingFormState,
  startDateTime: string,
  endDateTime: string,
  force = false
): BookingSubmissionData => ({
  ownerEmpCode: userProfile.empCode,
  ownerGroup: formState.ownerGroup,
  meetingRoom: formState.meetingRoom.trim(),
  meetingDetail: formState.meetingDetail.trim() || undefined,
  highPriority: formState.highPriority,
  timeStart: startDateTime,
  timeEnd: endDateTime,
  bookingStatus: "waiting",
  inviteEmails: formState.inviteEmails.length > 0 ? formState.inviteEmails : undefined,
  ...(force ? { force: true } : {}),
});

// Email management helpers
export const addInviteEmail = (
  newEmail: string,
  inviteEmails: string[],
  setInviteEmails: (emails: string[]) => void,
  setNewEmail: (email: string) => void
) => {
  if (newEmail && isValidEmail(newEmail) && !inviteEmails.includes(newEmail)) {
    setInviteEmails([...inviteEmails, newEmail]);
    setNewEmail("");
  }
};

export const removeInviteEmail = (
  emailToRemove: string,
  inviteEmails: string[],
  setInviteEmails: (emails: string[]) => void
) => {
  setInviteEmails(inviteEmails.filter((email) => email !== emailToRemove));
};

// Date formatting helpers
export const formatBookingDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatBookingDuration = (startTime: string, endTime: string): string => {
  return `${startTime} - ${endTime}`;
};
