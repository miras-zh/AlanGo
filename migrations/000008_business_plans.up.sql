-- 000008_business_plans.up.sql
-- Subscriptions are for business accounts only. Rename the template plans
-- (Standard / Pro / VIP) to business plans; codes stay the same so existing
-- users.plan values keep working.
UPDATE subscription_plans SET name = 'Старт', price_kzt = 0,
    features = ARRAY['1 спорткомплекс и до 2 залов', 'Онлайн-бронирование и график залов', 'Базовая статистика'],
    updated_at = NOW()
WHERE code = 'standard';

UPDATE subscription_plans SET name = 'Бизнес', price_kzt = 9990,
    features = ARRAY['До 10 залов', 'Финансы и база клиентов', 'Акции и промо-коды', 'Приоритетная поддержка'],
    updated_at = NOW()
WHERE code = 'pro';

UPDATE subscription_plans SET name = 'Премиум', price_kzt = 19990,
    features = ARRAY['Безлимит залов', 'Продвижение в каталоге и на главной', 'Сотрудники и роли', 'Персональный менеджер'],
    updated_at = NOW()
WHERE code = 'vip';
