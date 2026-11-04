import Link from "next/link";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← На главную
      </Link>
      <h1 className="text-3xl font-bold">Политика конфиденциальности — {SITE_NAME}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Приложение {SITE_NAME} уважает вашу конфиденциальность. Мы собираем только минимально
        необходимые данные для работы учетной записи (Email, имя профиля, идентификаторы
        устройства для отправки push-уведомлений).
      </p>
      <h2 className="text-xl font-bold">Удаление данных</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Вы можете удалить свой аккаунт и все связанные с ним данные в любой момент в разделе
        «Настройки → Удалить аккаунт» в мобильном приложении или веб-версии, либо написав на{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 underline">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
