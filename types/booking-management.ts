import type { BookingManage, Stats, StatusOption } from "./admin";

// Filter state interface
export interface BookingFilters {
  search: string;
  status: string;
  date: string;
  dateRequest: string;
  time: string;
}

// Pagination state interface
export interface PaginationState {
  currentPage: number;
  rowsPerPage: number;
  total: number;
  totalPages: number;
}

// Status option configuration
export interface StatusOptionConfig {
  value: StatusOption;
  label: string;
}

// Summary card configuration
export interface SummaryCardConfig {
  key: keyof Stats;
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

// Paginated bookings result
export interface PaginatedBookings {
  bookings: BookingManage[];
  totalPages: number;
  startIndex: number;
}

// Component state interface
export interface BookingManagementState {
  bookings: BookingManage[];
  error: string | null;
  filters: BookingFilters;
  pagination: PaginationState;
  isClient: boolean;
  currentMonth: string;
  currentYear: number | null;
  sortByDateAsc: boolean;
  showBookingDetailDialog: boolean;
  selectedBooking: BookingManage | null;
  showPast: boolean;
}
