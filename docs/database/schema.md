# 数据库设计

## 技术选型
- **主库**：Cloudflare D1 (SQLite)
- **缓存**：Cloudflare KV

---

## 核心表设计

### 1. announcements (公告表)

```sql
CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 基础信息
  title TEXT NOT NULL,                    -- 公告标题
  url TEXT NOT NULL UNIQUE,               -- 原始链接（唯一索引，去重）
  source_website_id INTEGER,              -- 来源网站ID（外键）
  
  -- 招考信息
  recruit_count INTEGER,                  -- 招考人数
  exam_subjects TEXT,                     -- 笔试科目（JSON 数组或逗号分隔）
  exam_date TEXT,                         -- 笔试日期 (ISO 8601)
  exam_time TEXT,                         -- 笔试具体时间段（如 "10:00-12:30"）
  
  -- 分类标签
  region TEXT,                            -- 地区（省/市/县）
  exam_type TEXT,                         -- 考试类型（三支一扶/事业单位/教师等）
  exam_category TEXT,                     -- 考试科目类别（职测/公基/综合等）
  
  -- 元数据
  publish_date TEXT,                      -- 公告发布时间
  crawled_at TEXT NOT NULL,               -- 爬取时间
  updated_at TEXT,                        -- 更新时间
  content_hash TEXT,                      -- 内容哈希（用于检测变更）
  
  -- 状态
  status TEXT DEFAULT 'active',           -- active/expired/deleted
  
  -- 索引
  FOREIGN KEY (source_website_id) REFERENCES source_websites(id)
);

-- 索引
CREATE INDEX idx_announcements_publish_date ON announcements(publish_date DESC);
CREATE INDEX idx_announcements_region ON announcements(region);
CREATE INDEX idx_announcements_exam_type ON announcements(exam_type);
CREATE INDEX idx_announcements_exam_date ON announcements(exam_date);
CREATE INDEX idx_announcements_crawled_at ON announcements(crawled_at DESC);
CREATE INDEX idx_announcements_url_hash ON announcements(url);
```

---

### 2. source_websites (来源网站表)

```sql
CREATE TABLE source_websites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 基础信息
  name TEXT NOT NULL,                     -- 网站名称（如"新疆兵团人事考试网"）
  base_url TEXT NOT NULL,                 -- 网站根域名
  list_url TEXT NOT NULL,                 -- 公告列表页URL
  
  -- 爬虫配置
  crawler_type TEXT DEFAULT 'cheerio',    -- 爬虫类型（cheerio/puppeteer）
  selector_config TEXT,                   -- 解析规则（JSON 格式）
  
  -- 分类
  region TEXT,                            -- 覆盖地区
  exam_type TEXT,                         -- 主要考试类型
  
  -- 状态
  status TEXT DEFAULT 'active',           -- active/paused/failed
  last_crawl_at TEXT,                     -- 最后爬取时间
  last_success_at TEXT,                   -- 最后成功时间
  error_count INTEGER DEFAULT 0,          -- 连续失败次数
  error_message TEXT,                     -- 最后错误信息
  
  -- 元数据
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT DEFAULT 'admin',        -- admin/user_submission
  
  -- 用户提交相关
  submission_user_contact TEXT,           -- 提交者联系方式
  submission_note TEXT,                   -- 提交备注
  reviewed_at TEXT,                       -- 审核时间
  reviewed_by TEXT                        -- 审核人
);

-- 索引
CREATE INDEX idx_source_websites_status ON source_websites(status);
CREATE INDEX idx_source_websites_region ON source_websites(region);
```

**selector_config 示例**：
```json
{
  "list": {
    "container": "ul.notice-list",
    "item": "li.item",
    "title": "a.title",
    "url": "a.title@href",
    "date": "span.date"
  },
  "detail": {
    "title": "h1.article-title",
    "content": "div.article-content",
    "recruitCount": "regex:(招聘|招考)(\\d+)人",
    "examSubjects": "regex:考试科目[：:](.*?)(?=\\n|$)",
    "examDate": "regex:(\\d{4})年(\\d{1,2})月(\\d{1,2})日"
  }
}
```

---

### 3. user_submissions (用户提交表)

```sql
CREATE TABLE user_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 提交内容
  website_url TEXT NOT NULL,              -- 用户提交的网站URL
  website_name TEXT,                      -- 用户填写的网站名称
  contact TEXT,                           -- 联系方式（邮箱/微信）
  note TEXT,                              -- 备注说明
  
  -- 状态
  status TEXT DEFAULT 'pending',          -- pending/approved/rejected
  reviewed_at TEXT,
  reviewed_by TEXT,
  reject_reason TEXT,
  
  -- 元数据
  created_at TEXT NOT NULL,
  ip_address TEXT                         -- 提交者IP（防刷）
);

-- 索引
CREATE INDEX idx_user_submissions_status ON user_submissions(status);
CREATE INDEX idx_user_submissions_created_at ON user_submissions(created_at DESC);
```

---

### 4. crawl_logs (爬取日志表)

```sql
CREATE TABLE crawl_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  source_website_id INTEGER NOT NULL,
  
  -- 执行结果
  status TEXT NOT NULL,                   -- success/failed/timeout
  new_count INTEGER DEFAULT 0,            -- 新增公告数
  updated_count INTEGER DEFAULT 0,        -- 更新公告数
  duration_ms INTEGER,                    -- 执行耗时（毫秒）
  
  -- 错误信息
  error_message TEXT,
  error_stack TEXT,
  
  -- 元数据
  started_at TEXT NOT NULL,
  finished_at TEXT,
  
  FOREIGN KEY (source_website_id) REFERENCES source_websites(id)
);

-- 索引
CREATE INDEX idx_crawl_logs_website_time ON crawl_logs(source_website_id, started_at DESC);
CREATE INDEX idx_crawl_logs_status ON crawl_logs(status);
```

---

## Cloudflare KV 使用

### 用途 1：URL 去重哈希
```
Key: `url_hash:{hash}`
Value: announcement_id
TTL: 30天（自动清理旧公告）
```

### 用途 2：网站配置缓存
```
Key: `website_config:{id}`
Value: { selector_config, crawler_type, ... }
TTL: 1小时
```

### 用途 3：爬取任务队列
```
Key: `crawl_queue`
Value: [website_id_1, website_id_2, ...]
```

---

## 数据字典

### announcements.exam_type (考试类型)
- `三支一扶`
- `事业单位`
- `教师招聘`
- `医疗卫生`
- `国企招聘`
- `其他`

### announcements.exam_category (科目类别)
- `职测` (职业能力倾向测验)
- `公基` (公共基础知识)
- `综合` (综合应用能力)
- `专业知识`
- `面试`

### announcements.status
- `active`: 正常展示
- `expired`: 已过期（笔试时间已过）
- `deleted`: 已删除

### source_websites.status
- `active`: 正常爬取
- `paused`: 暂停爬取（人工）
- `failed`: 连续失败（自动暂停）

---

## 查询优化

### 常见查询场景

#### 1. 首页最新公告（按发布时间）
```sql
SELECT * FROM announcements 
WHERE status = 'active'
ORDER BY publish_date DESC 
LIMIT 20;
```

#### 2. 按地区筛选
```sql
SELECT * FROM announcements 
WHERE status = 'active' AND region LIKE '%新疆%'
ORDER BY publish_date DESC;
```

#### 3. 按考试类型筛选
```sql
SELECT * FROM announcements 
WHERE status = 'active' AND exam_type = '三支一扶'
ORDER BY exam_date ASC;
```

#### 4. 组合筛选（地区 + 类型 + 时间范围）
```sql
SELECT * FROM announcements 
WHERE status = 'active'
  AND region = '新疆'
  AND exam_type = '三支一扶'
  AND exam_date >= '2026-07-01'
ORDER BY exam_date ASC;
```

---

## 数据迁移计划

### 初始化脚本
```sql
-- 创建所有表
-- 插入默认网站配置
-- 插入测试数据
```

### 备份策略
- 每天定时导出 D1 数据到 R2
- 关键操作前手动备份

---

## 扩展性考虑

### 未来可能新增字段
- `announcements.application_deadline`: 报名截止时间
- `announcements.salary_range`: 薪资范围
- `announcements.education_required`: 学历要求
- `announcements.tags`: 标签（JSON 数组）

### 分表策略（数据量大时）
- 按年份分表：`announcements_2026`, `announcements_2027`
- 历史数据归档到 R2

---

## 下一步

- [ ] 编写初始化 SQL 脚本
- [ ] 设计 API 接口
- [ ] 爬虫规则设计
