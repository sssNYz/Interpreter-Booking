export const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

import { FormData } from "../types";

export const createBookingData = (
  formData: FormData,
  dayObj: { fullDate: Date },
  startTime: string,
  endTime: string
) => {
  const localDate = getLocalDateString(dayObj.fullDate);
  const startDateTime = `${localDate}T${startTime}:00.000`;
  const endDateTime = `${localDate}T${endTime}:00.000`;

  return {
    ownerName: formData.ownerName.trim(),
    ownerSurname: formData.ownerSurname.trim(),
    ownerEmail: formData.ownerEmail.trim(),
    ownerTel: formData.ownerTel.trim(),
    ownerGroup: formData.ownerGroup,
    meetingRoom: formData.meetingRoom.trim(),
    meetingDetail: formData.meetingDetail.trim() || undefined,
    highPriority: formData.highPriority,
    timeStart: startDateTime,
    timeEnd: endDateTime,
    interpreterId: formData.interpreterId
      ? parseInt(formData.interpreterId)
      : null,
    bookingStatus: "waiting", // Default to waiting
    inviteEmails:
      formData.inviteEmails.length > 0 ? formData.inviteEmails : undefined,
  };
};
