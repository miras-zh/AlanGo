-- 000008_business_plans.down.sql
UPDATE subscription_plans SET name = 'Standard', price_kzt = 0,
    features = ARRAY['Базовый функционал', 'До 10 записей'] WHERE code = 'standard';
UPDATE subscription_plans SET name = 'Pro', price_kzt = 2990,
    features = ARRAY['Расширенный доступ', 'Безлимитные записи', 'Приоритетная поддержка'] WHERE code = 'pro';
UPDATE subscription_plans SET name = 'VIP', price_kzt = 7990,
    features = ARRAY['Полный доступ ко всем функциям', 'Персональные уведомления', 'VIP статус'] WHERE code = 'vip';
