"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  createItem,
  deleteItem,
  ItemEntity,
  ItemStatus,
  listMyItems,
  updateItem,
} from "@/lib/items";
import { logoutWebSession } from "@/lib/user";

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemEntity[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ItemStatus>("active");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await listMyItems();
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getSessionUser()) {
      router.replace("/login");
      return;
    }
    load();
  }, [router]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createItem({ title: title.trim(), description: description.trim(), status });
    setTitle("");
    setDescription("");
    await load();
  };

  const handleToggleStatus = async (item: ItemEntity) => {
    const next: ItemStatus = item.status === "active" ? "draft" : "active";
    await updateItem(item.id, { status: next });
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← На главную
          </Link>
          <h1 className="text-2xl font-bold mt-1">Мои записи</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium"
          >
            Профиль
          </Link>
          <button
            onClick={async () => {
              await logoutWebSession();
              router.replace("/");
            }}
            className="px-4 py-2 rounded-xl text-sm text-red-600 border border-red-200 hover:bg-red-50"
          >
            Выйти
          </button>
        </div>
      </header>

      <form
        onSubmit={handleCreate}
        className="my-8 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
      >
        <h2 className="text-lg font-bold">Создать запись</h2>
        <input
          type="text"
          required
          placeholder="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
        />
        <textarea
          placeholder="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
        />
        <div className="flex items-center justify-between">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ItemStatus)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
          >
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Добавить
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-sm text-slate-500">Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-500">
          У вас пока нет записей
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold uppercase text-blue-600">{item.status}</span>
                <h3 className="text-base font-bold">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleStatus(item)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                >
                  Сменить статус
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
