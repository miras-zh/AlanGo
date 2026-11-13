import axios from "axios";
import { useCallback } from "react";
import { getLocale, tr, useT, type MessageKey } from "@/lib/i18n";

// Backend errors are plain English strings (see internal/*/handler.go). Known
// ones are translated; unknown English text is replaced by the caller's
// fallback in ru/kk so users never see raw server English.
export const BACKEND_ERROR_KEYS: Record<string, MessageKey> = {
  "email already registered": "errors.emailTaken",
  "password must be at least 8 characters": "errors.weakPassword",
  "password must contain letters, digits and a special character": "errors.weakPassword",
  "password must not exceed 72 characters": "errors.passwordTooLong",
  "registration not found or expired": "errors.registrationExpired",
  "invalid verification code": "errors.invalidCode",
  "too many invalid code attempts, please sign up again": "errors.tooManyCodeAttempts",
  "verification code was just sent, please wait": "errors.resendTooSoon",
  "too many verification emails requested for this address": "errors.resendTooMany",
  "invalid email or password": "errors.wrongCredentials",
  "invalid email format": "errors.invalidEmail",
  "email is required": "errors.emailRequired",
  "full_name is required": "errors.nameRequired",
  "full_name is too long": "errors.nameTooLong",
  "account disabled": "errors.accountDisabled",
  "account disabled or not found": "errors.accountDisabled",
  "could not verify apple account, try again": "errors.appleFailed",
  "failed to sign in with apple": "errors.appleFailed",
  "invalid apple token": "errors.appleFailed",
  "sign in with apple is not available": "errors.appleUnavailable",
  "could not verify google account, try again": "errors.googleFailed",
  "failed to sign in with google": "errors.googleFailed",
  "invalid google token": "errors.googleFailed",
  "google sign-in is not available": "errors.googleUnavailable",
  unauthorized: "errors.forbidden",
  forbidden: "errors.forbidden",
  "missing authorization header": "errors.sessionExpired",
  "invalid authorization header": "errors.sessionExpired",
  "invalid token": "errors.sessionExpired",
  "token has been revoked": "errors.sessionExpired",
  "too many requests, slow down": "errors.rateLimited",
  "too many requests from this address, slow down": "errors.rateLimited",
  "too many login attempts from this address, slow down": "errors.tooManyLogins",
  "too many password reset requests from this address, slow down": "errors.rateLimited",
  "too many failed login attempts, try again later": "errors.tooManyLogins",
  "file exceeds the maximum upload size of 5MB": "errors.fileTooLarge",
  "file must be a JPEG, PNG or WebP image": "errors.fileType",
  "database unavailable": "errors.serverUnavailable",
  "redis unavailable": "errors.serverUnavailable",
};

function serverText(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const data = err.response?.data as any;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (typeof data?.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data?.error === "string" && data.error.trim()) return data.error.trim();
  return null;
}

export function backendErrorKey(err: unknown): MessageKey | null {
  const text = serverText(err);
  if (text && BACKEND_ERROR_KEYS[text]) return BACKEND_ERROR_KEYS[text];
  if (axios.isAxiosError(err) && !err.response) return "errors.network";
  return null;
}

// Text written in Latin letters only — i.e. raw English from the server.
const isLatinOnly = (s: string) => /[a-z]/i.test(s) && !/[^\x00-\x7F₸«»—–…]/.test(s);

export function getErrorMessage(err: unknown, fallback?: string): string {
  const fb = fallback ?? tr("errors.generic");
  const key = backendErrorKey(err);
  if (key) return tr(key);
  const text = serverText(err) ?? (err instanceof Error ? err.message : null);
  if (!text) return fb;
  if (getLocale() !== "en" && isLatinOnly(text)) return fb;
  return text;
}

export function useErrorMessage() {
  const t = useT();
  return useCallback(
    (err: unknown, fallback: string): string => {
      const key = backendErrorKey(err);
      return key ? t(key) : getErrorMessage(err, fallback);
    },
    [t],
  );
}
