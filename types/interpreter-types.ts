// ==================== Base Types ====================

export type InterpreterStatus = 'available' | 'busy';

// Frontend Type
export interface Interpreter {
  id: number;
  name: string;
  phone: string;
  email: string;
  status: InterpreterStatus;
  completedBookings: number;
}

// Backend Type 
export interface InterpreterFromAPI {
  interpreterId: number;
  interpreterName: string;
  interpreterSurname: string;
  interpreterPhone: string;
  interpreterEmail: string;
  bookingPlans?: { bookingId: number }[];
}

// Utility function: Map API -> Frontend
export const mapInterpreter = (api: InterpreterFromAPI): Interpreter => ({
  id: api.interpreterId,
  name: `${api.interpreterName} ${api.interpreterSurname}`,
  phone: api.interpreterPhone,
  email: api.interpreterEmail,
  status: 'available', // default
  completedBookings: api.bookingPlans?.length ?? 0,
});

// ==================== Component Props ====================

export type InterpreterHandler = (interpreter: Interpreter) => void;

export interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  interpreter: Interpreter | null;
  newStatus: InterpreterStatus | null;
}

export interface StatusBadgeProps {
  status: InterpreterStatus;
}

export interface ActionButtonsProps {
  interpreter: Interpreter;
  onEdit: InterpreterHandler;
  onDelete: InterpreterHandler;
  onStatusChange: InterpreterHandler;
}


// /types/interpreter-types.ts
export type InterpreterResponse = {
  interpreterId: number;        // <-- แก้จาก string | number เป็น number
  interpreterName: string;
  interpreterSurname: string;
  interpreterPhone: string;
  interpreterEmail: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AddInterpreterInput = {
  id?: number | string;
  empCode?: string;

  // ชุดที่มาจากฟอร์ม
  interpreterName?: string;
  interpreterSurname?: string;
  interpreterEmail?: string;
  interpreterPhone?: string;

  // ชุดที่มาจาก API/DB
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

