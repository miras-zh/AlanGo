import axios from "axios";
import { useCallback } from "react";
import { useT } from "@/lib/i18n";

export const BACKEND_ERROR_KEYS: Record<string, string> = {
  "email already registered": "errors.emailTaken",
  "password must be at least 8 characters": "register.errWeakPassword",
  "password must contain letters, digits and a special character": "register.errWeakPassword",
  "registration not found or expired": "register.errTokenExpired",
  "invalid verification code": "register.errInvalidCode",
  "too many invalid code attempts, please sign up again": "register.errTooManyAttempts",
  "verification code was just sent, please wait": "register.errResendTooSoon",
  "too many verification emails requested for this address": "register.errResendTooMany",
  unauthorized: "errors.forbidden",
  forbidden: "errors.forbidden",
  "invalid token": "errors.sessionExpired",
  "token has been revoked": "errors.sessionExpired",
  "too many requests, slow down": "errors.rateLimited",
  "too many failed login attempts, try again later": "errors.tooManyLogins",
  "file exceeds the maximum upload size of 5MB": "errors.fileTooLarge",
  "file must be a JPEG, PNG or WebP image": "errors.fileType",
};

export function backendErrorKey(err: unknown): string | null {
  if (axios.isAxiosError(err) && typeof err.response?.data === "string") {
    return BACKEND_ERROR_KEYS[err.response.data.trim()] ?? null;
  }
  return null;
}

export function getErrorMessage(err: unknown, fallback = "Произошла ошибка"): string {
  if (axios.isAxiosError(err)) {
    if (typeof err.response?.data === "string" && err.response.data.trim()) {
      return err.response.data.trim();
    }
    const data = err.response?.data as any;
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error.trim();
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function useErrorMessage() {
  const t = useT();
  return useCallback(
    (err: unknown, fallback: string): string => {
      const key = backendErrorKey(err);
      return key ? t(key) : fallback;
    },
    [t],
  );
}
