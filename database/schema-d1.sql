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
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'partial')),
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
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON user_feedback(created_at DESC);
