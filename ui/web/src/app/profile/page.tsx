"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { deleteMyAccount, updateMe } from "@/lib/user";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const u = getSessionUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setName(u.name || "");
    setPhone(u.phone || "");
    setBio(u.bio || "");
  }, [router]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    await updateMe({ name: name.trim(), phone: phone.trim(), bio: bio.trim() });
    setSaved(true);
  };

  const handleDelete = async () => {
    if (!window.confirm("Удалить аккаунт и все данные безвозвратно?")) return;
    await deleteMyAccount();
    router.replace("/");
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Назад в панель
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Настройки профиля</h1>

      <form
        onSubmit={handleSave}
        className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
      >
        {saved && (
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">
            Профиль сохранён
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Имя</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Телефон</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">О себе</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
          />
        </div>
        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          Сохранить
        </button>
      </form>

      <div className="mt-8 p-6 rounded-2xl border border-red-200 dark:border-red-900/50">
        <h2 className="text-base font-bold text-red-600 mb-1">Удаление аккаунта</h2>
        <p className="text-xs text-slate-500 mb-4">
          В соответствии с требованиями App Store и GDPR вы можете полностью удалить свой аккаунт и связанные данные.
        </p>
        <button
          onClick={handleDelete}
          className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
        >
          Удалить мой аккаунт
        </button>
      </div>
    </div>
  );
}
