import { api } from "@/lib/api";

export type StartRegistrationRequest = {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  photo?: string;
};

export async function startRegistration(payload: StartRegistrationRequest): Promise<{ token: string }> {
  const res = await api.post<{ token: string }>("/api/register", payload);
  return res.data;
}

export type VerifyRegistrationResult = {
  user_info: {
    id: number;
    full_name: string;
    email: string;
    role: string;
    phone?: string;
    city?: string;
    photo?: string;
  };
  email: string;
  token: string;
  refresh_token?: string;
};

export async function verifyRegistration(token: string, code: string): Promise<VerifyRegistrationResult> {
  const res = await api.post<VerifyRegistrationResult>("/api/register/verify", { token, code });
  return res.data;
}

export async function resendRegistrationCode(token: string): Promise<void> {
  await api.post("/api/register/resend", { token });
}

export function passwordStrengthError(password: string): string | null {
  if (password.length < 8) return "tooShort";
  const hasLetter = /\p{L}/u.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^\s\p{L}\d]/u.test(password);
  if (!hasLetter || !hasDigit || !hasSpecial) return "tooWeak";
  return null;
}
