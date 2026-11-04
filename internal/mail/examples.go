package mail

import "fmt"

// Примеры готовых почтовых сценариев (SMTP), которые помогут при развитии продукта:
//
// 1. SendWelcomeEmail          — Приветственное письмо после регистрации (увеличивает активацию в First Value).
// 2. SendPasswordResetEmail    — Сброс пароля или отправка одноразового кода подтверждения (OTP).
// 3. SendTrialEndingEmail      — Напоминание за 24 часа до окончания пробного периода (снижает отток и чарджбэки).
// 4. SendWeeklyDigestEmail     — Еженедельный отчёт прогресса пользователя (возвращает неактивных пользователей — Retention).

func (s *Sender) SendWelcomeEmail(toEmail, userName string) error {
	subject := fmt.Sprintf("Добро пожаловать, %s!", userName)
	return s.SendTemplate([]string{toEmail}, subject, TemplateData{
		Title:      subject,
		Name:       userName,
		Message:    "Спасибо за регистрацию! Мы подготовили всё необходимое, чтобы вы получили первый результат уже сегодня.",
		ButtonURL:  s.cfg.SiteURL,
		ButtonText: "Открыть приложение",
	})
}

func (s *Sender) SendPasswordResetEmail(toEmail, resetLink string) error {
	subject := "Восстановление доступа к аккаунту"
	return s.SendTemplate([]string{toEmail}, subject, TemplateData{
		Title:      subject,
		Message:    "Вы запросили восстановление пароля. Перейдите по кнопке ниже (ссылка действительна 1 час).",
		ButtonURL:  resetLink,
		ButtonText: "Сбросить пароль",
	})
}

func (s *Sender) SendTrialEndingEmail(toEmail, userName, planName string) error {
	subject := "Ваш пробный период скоро завершится"
	return s.SendTemplate([]string{toEmail}, subject, TemplateData{
		Title:      subject,
		Name:       userName,
		Message:    fmt.Sprintf("Пробный доступ к тарифу %s заканчивается через 24 часа.", planName),
		Highlight:  "Вы можете управлять подпиской в настройках профиля в любой момент.",
		ButtonURL:  s.cfg.SiteURL + "/profile",
		ButtonText: "Управлять подпиской",
	})
}

func (s *Sender) SendWeeklyDigestEmail(toEmail, userName, summaryText string) error {
	subject := "Ваша сводка активности за неделю"
	return s.SendTemplate([]string{toEmail}, subject, TemplateData{
		Title:      subject,
		Name:       userName,
		Message:    summaryText,
		ButtonURL:  s.cfg.SiteURL + "/dashboard",
		ButtonText: "Посмотреть статистику",
	})
}
