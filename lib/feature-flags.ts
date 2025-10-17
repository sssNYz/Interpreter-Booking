// Centralized feature flags for client and server
// Client-side: use NEXT_PUBLIC_* envs
// Server-side (API routes): use non-public envs

const asBool = (v: string | undefined, defaultFalse = false): boolean => {
  if (v == null) return defaultFalse;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
};

export const client = {
  enableRoomBooking: asBool(process.env.NEXT_PUBLIC_ENABLE_ROOM_BOOKING),
  enableJumpToCalendar: asBool(process.env.NEXT_PUBLIC_ENABLE_JUMP_TO_CALENDAR),
  enableForwardUser: asBool(process.env.NEXT_PUBLIC_ENABLE_FORWARD_USER),
  enableForwardAdmin: asBool(process.env.NEXT_PUBLIC_ENABLE_FORWARD_ADMIN),
};

export const server = {
  enableRoomBooking: asBool(process.env.ENABLE_ROOM_BOOKING),
  enableForwardUser: asBool(process.env.ENABLE_FORWARD_USER),
  enableForwardAdmin: asBool(process.env.ENABLE_FORWARD_ADMIN),
  enableMsTeams: asBool(process.env.ENABLE_MS_TEAMS),
};
