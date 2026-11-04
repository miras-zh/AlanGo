"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/password-reset/confirm", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ token, new_password: password }),
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сброса пароля");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
      <input
        type="password"
        required
        minLength={6}
        placeholder="Новый пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
      >
        {loading ? "Сохранение..." : "Сохранить новый пароль"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Новый пароль</h1>
        <Suspense fallback={<div className="text-sm text-slate-500">Загрузка...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
