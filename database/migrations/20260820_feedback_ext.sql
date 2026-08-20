-- 2026-08-20 反馈系统扩展（T5）
-- 用途：详情页纠错反馈 + 全站反馈中心 + admin 后台
ALTER TABLE user_feedback ADD COLUMN announcement_id INTEGER;
ALTER TABLE user_feedback ADD COLUMN contact TEXT;
ALTER TABLE user_feedback ADD COLUMN ip TEXT;
