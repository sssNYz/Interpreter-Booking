import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Utility function to ensure business rule: when interpreterEmpCode is assigned,
 * bookingStatus must be set to "approve"
 */
export function ensureBookingStatusOnAssignment(data: {
  interpreterEmpCode?: string | null;
  bookingStatus?: string;
}): { interpreterEmpCode?: string | null; bookingStatus?: string } {
  const result = { ...data };
  
  // If interpreterEmpCode is being set to a non-null value, ensure bookingStatus is "approve"
  if (result.interpreterEmpCode !== undefined && result.interpreterEmpCode !== null) {
    result.bookingStatus = "approve";
  }
  
  return result;
}
