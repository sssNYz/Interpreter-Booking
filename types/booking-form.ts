import type { OwnerGroup } from "./booking";

export interface BookingFormState {
  startTime: string;
  endTime: string;
  ownerName: string;
  ownerSurname: string;
  ownerEmail: string;
  ownerTel: string;
  ownerGroup: OwnerGroup;
  meetingRoom: string;
  meetingDetail: string;
  highPriority: boolean;
  interpreterId: string;
  inviteEmails: string[];
  newEmail: string;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

export interface BookingFormValidation {
  meetingRoom: string;
  startTime: string;
  endTime: string;
}

export interface BookingSubmissionData {
  ownerEmpCode: string;
  ownerGroup: OwnerGroup;
  meetingRoom: string;
  meetingDetail?: string;
  highPriority: boolean;
  timeStart: string;
  timeEnd: string;
  bookingStatus: string;
  inviteEmails?: string[];
  force?: boolean;
}

export interface ToastConfig {
  title: string;
  description: string;
  type: "success" | "error" | "warning";
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  empCode: string;
}

export const OWNER_GROUP_OPTIONS = [
  { value: "software" as const, label: "Software" },
  { value: "iot" as const, label: "IoT" },
  { value: "hardware" as const, label: "Hardware" },
  { value: "other" as const, label: "Other" },
] as const;

export const DEFAULT_FORM_STATE: BookingFormState = {
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
  isSubmitting: false,
  errors: {},
};
