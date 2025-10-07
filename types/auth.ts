export type LoginRequest = {
  empCode: string;
  oldPassword: string;
};

export type SessionUser = {
  id: string;
  empCode: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type LoginResponse =
  | { ok: true; user: SessionUser }
  | { ok: false; message: string; debug?: any };


