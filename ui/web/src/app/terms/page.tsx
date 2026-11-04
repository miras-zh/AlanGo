import Link from "next/link";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← На главную
      </Link>
      <h1 className="text-3xl font-bold">Условия использования — {SITE_NAME}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Используя {SITE_NAME}, вы соглашаетесь соблюдать правила сервиса и не размещать
        запрещённый или нарушающий права третьих лиц контент.
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        По всем вопросам обращайтесь в службу поддержки:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 underline">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
