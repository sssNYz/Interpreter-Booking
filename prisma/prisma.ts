import {
  PrismaClient,
  OwnerGroup,
  BookingStatus,
  MeetingType,
  RecurrenceType,
  EndType,
  WeekOrder,
  DRType,
  OtherTypeScope,
  BookingKind,
} from "@prisma/client";
  declare global {
  var prisma: PrismaClient | undefined;
}
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();



if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export {
  prisma as default,
  OwnerGroup,
  BookingStatus,
  MeetingType,
  RecurrenceType,
  EndType,
  WeekOrder,
  DRType,
  OtherTypeScope,
  BookingKind,
};
