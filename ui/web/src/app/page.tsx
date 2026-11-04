"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { getSessionUser, SessionUser } from "@/lib/auth";
import { ItemEntity, listPublicItems } from "@/lib/items";

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<ItemEntity[]>([]);

  useEffect(() => {
    setUser(getSessionUser());
    listPublicItems()
      .then((res) => setItems(res.items || []))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between pb-8 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-blue-600">{SITE_NAME}</h1>
          <p className="text-sm text-slate-500">{SITE_TAGLINE}</p>
        </div>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Панель управления
              </Link>
              <Link
                href="/profile"
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium"
              >
                {user.name}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="my-12 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-3xl font-bold mb-3">
          Готовый Full-Stack каркас для быстрого запуска продуктов
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mb-6">
          Включает Go 1.25 API, PostgreSQL, Redis, JWT + Apple/Google Sign-In, FCM/APNs пуши,
          WebSocket realtime, аналитику воронки Case Operation и готовый CRUD.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={user ? "/dashboard" : "/register"}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            {user ? "Открыть мои записи" : "Начать работу"}
          </Link>
          <Link
            href="/privacy"
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium"
          >
            Политика конфиденциальности
          </Link>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold mb-4">Публичные записи</h3>
        {items.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-500">
            Пока нет опубликованных записей. Создайте первую в панели управления!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    {item.category}
                  </span>
                  {item.price > 0 && (
                    <span className="text-sm font-bold">{item.price.toLocaleString("ru-RU")} ₸</span>
                  )}
                </div>
                <h4 className="text-lg font-bold">{item.title}</h4>
                {item.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
        <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="hover:underline">Terms of Use</Link>
        </div>
      </footer>
    </div>
  );
}
