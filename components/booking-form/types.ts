export type OwnerGroup = "software" | "iot" | "hardware" | "other";

export type BookingFormProps = {
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

export type FormData = {
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
};
