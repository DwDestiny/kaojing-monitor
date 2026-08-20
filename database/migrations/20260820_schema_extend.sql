-- 2026-08-20 P1 schema 扩展（MASTER_UPGRADE_PLAN 3.2）
-- 用途：考试聚合字段 + 合规分级 + 缺失值语义 + 全生命周期时间节点
-- 注意：一次性迁移，勿重复执行；新库直接用 database/schema-d1.sql（已同步）
-- 幂等校验：SELECT COUNT(*) FROM pragma_table_info('announcements') WHERE name='exam_name';

-- 1. announcements 表扩展（考试聚合 + 时间节点 + 合规）
ALTER TABLE announcements ADD COLUMN exam_name TEXT;              -- 考试名称（如"上海市事业单位2026"）
ALTER TABLE announcements ADD COLUMN exam_year TEXT;              -- 招考年份
ALTER TABLE announcements ADD COLUMN exam_stage TEXT;             -- 进度：announced/registering/permit/examined/scored/interviewed/done
ALTER TABLE announcements ADD COLUMN registration_start TEXT;     -- 报名开始时间
ALTER TABLE announcements ADD COLUMN payment_start TEXT;          -- 缴费开始
ALTER TABLE announcements ADD COLUMN payment_deadline TEXT;       -- 缴费截止
ALTER TABLE announcements ADD COLUMN permit_print_time TEXT;      -- 准考证打印
ALTER TABLE announcements ADD COLUMN exam_score_time TEXT;        -- 笔试出成绩时间
ALTER TABLE announcements ADD COLUMN exam_score_rank INTEGER;     -- 是否告知排名 0/1
ALTER TABLE announcements ADD COLUMN interview_time TEXT;         -- 面试时间
ALTER TABLE announcements ADD COLUMN interview_form TEXT;         -- 面试形式
ALTER TABLE announcements ADD COLUMN interview_list_time TEXT;    -- 面试名单发布时间
ALTER TABLE announcements ADD COLUMN interview_ratio TEXT;        -- 面试比例
ALTER TABLE announcements ADD COLUMN physical_test_time TEXT;     -- 体测时间
ALTER TABLE announcements ADD COLUMN qualification_review_time TEXT; -- 资格审查时间
ALTER TABLE announcements ADD COLUMN is_known TEXT DEFAULT 'unknown'; -- 缺失语义 known/unknown/na/none
ALTER TABLE announcements ADD COLUMN compliance_level TEXT DEFAULT 'safe'; -- 合规级别 safe/attribution/restricted
ALTER TABLE announcements ADD COLUMN raw_html_snippet TEXT;       -- 提取用正文片段（受限源为空）

-- 索引
CREATE INDEX IF NOT EXISTS idx_announcements_exam_name ON announcements(exam_name);
CREATE INDEX IF NOT EXISTS idx_announcements_exam_stage ON announcements(exam_stage);
CREATE INDEX IF NOT EXISTS idx_announcements_is_known ON announcements(is_known);

-- 2. 新表：考试资料链接（职位表/报考指南/专业目录等）
CREATE TABLE IF NOT EXISTS exam_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  material_type TEXT NOT NULL,  -- job_list(职位表)/guide(报考指南)/catalog(专业目录)/faq(常见问题)/other
  title TEXT,
  url TEXT NOT NULL,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id)
);
CREATE INDEX IF NOT EXISTS idx_materials_announcement ON exam_materials(announcement_id);

-- 3. 新表：政策差异库（19 问，暂缓填充）
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

-- 4. 新表：对比数据（自动计算，暂缓填充）
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

-- 5. 新表：备注/话术（辅导员内部）
CREATE TABLE IF NOT EXISTS exam_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  note TEXT,
  note_type TEXT DEFAULT 'general',  -- general/warning/speech(话术)/reference
  created_at TEXT,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id)
);
CREATE INDEX IF NOT EXISTS idx_notes_announcement ON exam_notes(announcement_id);
