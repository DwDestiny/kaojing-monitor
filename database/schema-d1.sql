-- 考情监测系统 - D1 数据库完整 Schema
-- 基于 docs/database/schema.md，增强版

-- 1. 公告表
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  url_hash TEXT NOT NULL UNIQUE,
  content_hash TEXT,
  source_website_id INTEGER,
  source TEXT NOT NULL,
  region TEXT NOT NULL,

  -- 提取字段
  recruit_count INTEGER,
  exam_date TEXT,
  exam_time TEXT,
  exam_subjects TEXT,
  exam_type TEXT,
  exam_category TEXT,
  exam_location TEXT,
  registration_deadline TEXT,
  salary_range TEXT,
  exam_note TEXT,  -- 笔试状态说明：'免笔试'（整条公告无笔试，前端显示"无笔试"）；NULL=有笔试或未标记

  -- P1 扩展（2026-08-20）：考试聚合 + 时间节点 + 合规分级
  exam_name TEXT,               -- 考试名称（如"上海市事业单位2026"）
  exam_year TEXT,               -- 招考年份
  exam_stage TEXT,              -- 进度：announced/registering/permit/examined/scored/interviewed/done
  registration_start TEXT,      -- 报名开始时间
  payment_start TEXT,           -- 缴费开始
  payment_deadline TEXT,        -- 缴费截止
  permit_print_time TEXT,       -- 准考证打印
  exam_score_time TEXT,         -- 笔试出成绩时间
  exam_score_rank INTEGER,      -- 是否告知排名 0/1
  interview_time TEXT,          -- 面试时间
  interview_form TEXT,          -- 面试形式
  interview_list_time TEXT,     -- 面试名单发布时间
  interview_ratio TEXT,         -- 面试比例
  physical_test_time TEXT,      -- 体测时间
  qualification_review_time TEXT, -- 资格审查时间
  is_known TEXT DEFAULT 'unknown',  -- 缺失语义 known/unknown/na/none
  compliance_level TEXT DEFAULT 'safe', -- 合规级别 safe/attribution/restricted
  raw_html_snippet TEXT,        -- 提取用正文片段（受限源为空）

  -- 时间戳
  publish_date TEXT,
  crawled_at TEXT NOT NULL,
  extracted_at TEXT,

  -- 状态
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'deleted')),

  -- 原始数据
  raw_html TEXT,

  -- 索引字段
  FOREIGN KEY (source_website_id) REFERENCES source_websites(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_announcements_region ON announcements(region);
CREATE INDEX IF NOT EXISTS idx_announcements_exam_type ON announcements(exam_type);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_date ON announcements(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_url_hash ON announcements(url_hash);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_exam_name ON announcements(exam_name);
CREATE INDEX IF NOT EXISTS idx_announcements_exam_stage ON announcements(exam_stage);
CREATE INDEX IF NOT EXISTS idx_announcements_is_known ON announcements(is_known);

-- P1 新表（2026-08-20）
-- 考试资料链接（职位表/报考指南/专业目录等）
CREATE TABLE IF NOT EXISTS exam_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  material_type TEXT NOT NULL,  -- job_list(职位表)/guide(报考指南)/catalog(专业目录)/faq(常见问题)/other
  title TEXT,
  url TEXT NOT NULL,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id)
);
CREATE INDEX IF NOT EXISTS idx_materials_announcement ON exam_materials(announcement_id);

-- 政策差异库（19 问，暂缓填充）
CREATE TABLE IF NOT EXISTS exam_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL,
  exam_type TEXT NOT NULL,       -- 公考/选调/事考
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  year TEXT,
  source_url TEXT,
  UNIQUE(region, exam_type, question, year)
);

-- 对比数据（自动计算，暂缓填充）
CREATE TABLE IF NOT EXISTS exam_compare (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_name TEXT NOT NULL,
  year TEXT NOT NULL,
  announce_date TEXT,
  exam_date TEXT,
  recruit_count INTEGER,
  applicant_count INTEGER,
  score_date TEXT,
  interview_date TEXT,
  UNIQUE(exam_name, year)
);

-- 备注/话术（辅导员内部）
CREATE TABLE IF NOT EXISTS exam_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  note TEXT,
  note_type TEXT DEFAULT 'general',  -- general/warning/speech(话术)/reference
  created_at TEXT,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id)
);
CREATE INDEX IF NOT EXISTS idx_notes_announcement ON exam_notes(announcement_id);

-- 2. 数据源网站表
CREATE TABLE IF NOT EXISTS source_websites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL,
  website_type TEXT,
  priority INTEGER DEFAULT 3,
  selector_config TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('active', 'pending', 'disabled', 'failed')),
  last_crawl_at TEXT,
  last_crawl_count INTEGER DEFAULT 0,
  total_crawled INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. 爬取日志表
CREATE TABLE IF NOT EXISTS crawl_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  website_id INTEGER NOT NULL,
  -- status: success/failed/partial 为爬取结果；triggered 为 Cron 触发记录（Workers scheduled 写入，等待外部爬虫执行）
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'partial', 'triggered')),
  items_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  FOREIGN KEY (website_id) REFERENCES source_websites(id)
);

CREATE INDEX IF NOT EXISTS idx_crawl_logs_website ON crawl_logs(website_id);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_started_at ON crawl_logs(started_at DESC);

-- 4. 用户反馈表
CREATE TABLE IF NOT EXISTS user_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('new_website', 'bug_report', 'data_error', 'feature_request', 'other')),
  content TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'resolved', 'rejected')),
  created_at TEXT NOT NULL,
  processed_at TEXT,
  notes TEXT,
  -- 2026-08-20 反馈系统扩展（T5）：
  announcement_id INTEGER,  -- 绑定的公告 id（详情页纠错）
  contact TEXT,             -- 联系方式（选填）
  ip TEXT                   -- 提交者 IP（限频用）
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON user_feedback(created_at DESC);
