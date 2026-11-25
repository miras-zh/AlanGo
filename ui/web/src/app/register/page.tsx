"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resendRegistrationCode, startRegistration, verifyRegistration } from "@/lib/user";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regToken, setRegToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStart = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await startRegistration(name.trim(), email.trim(), password);
      setRegToken(res.token);
      setInfo("Мы отправили 6-значный код подтверждения на ваш Email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!regToken) return;
    setError("");
    setLoading(true);
    try {
      await verifyRegistration(regToken, code.trim());
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный код подтверждения");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!regToken) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await resendRegistrationCode(regToken);
      setInfo("Код отправлен повторно.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">
          {regToken ? "Подтверждение Email" : "Регистрация"}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          {regToken ? `Введите код, отправленный на ${email}` : "Создайте новый аккаунт"}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>
        )}
        {info && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{info}</div>
        )}

        {!regToken ? (
          <form onSubmit={handleStart} className="space-y-4">
            <input
              type="text"
              required
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Пароль (минимум 8 символов, буква, цифра и спецсимвол)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Отправка кода..." : "Продолжить"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              required
              inputMode="numeric"
              placeholder="Код подтверждения"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Проверка..." : "Подтвердить и создать аккаунт"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleResend}
              className="w-full py-2 text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              Отправить код повторно
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
