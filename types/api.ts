export type SortOrder = "asc" | "desc";

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
};

export type BookingApiResponse = Paginated<import("./booking").BookingData>;

export type BookingFilters = {
  page?: number;
  pageSize?: number;
  status?: string | "all";
  sort?: SortOrder;
  empCode?: string;
};

export type ApiResponse<T = Record<string, unknown>> = {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: T;
};


