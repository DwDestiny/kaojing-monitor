# 数据库开发规范（Cloudflare D1 SQLite）

**适用范围**：`database/` 目录 schema + 爬虫生成 SQL + Workers 内 D1 查询
**强制约束**：所有子代理开发必须遵循本规范，schema 变更按本规范评审

---

## 1. 命名规范

| 项 | 规则 | 示例 |
|---|---|---|
| 表名 | 复数 snake_case | `announcements`、`exam_materials` |
| 列名 | snake_case | `exam_subjects` |
| 主键 | `id INTEGER PRIMARY KEY AUTOINCREMENT` | — |
| 外键 | `<target>_id` | `source_website_id` |
| 唯一键 | 业务自然键 | `url_hash UNIQUE`、`(region, exam_type, question, year) UNIQUE` |
| 索引 | `idx_<table>_<col>` | `idx_announcements_region` |
| 时间戳 | ISO 8601 TEXT | `'2026-08-19T14:30:00Z'` |
| 日期 | `YYYY-MM-DD` TEXT | `'2026-08-19'` |

## 2. 表结构约定

```sql
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  url_hash TEXT NOT NULL UNIQUE,
  content_hash TEXT,
  source_website_id INTEGER,
  source TEXT NOT NULL,
  region TEXT NOT NULL,
  -- 提取字段（全部可空，用 is_known 表达缺失语义）
  recruit_count INTEGER,
  exam_date TEXT,
  -- ...
  status TEXT DEFAULT 'active' CHECK(status IN ('active','archived','deleted')),
  raw_html TEXT,
  crawled_at TEXT NOT NULL,
  extracted_at TEXT,
  FOREIGN KEY (source_website_id) REFERENCES source_websites(id)
);
```

**硬性规则**：
1. 每个表必须：主键 + 至少 1 个业务唯一键 + 常用查询列索引
2. 提取字段一律可空（NULL 表示未提取），缺失语义由 `is_known` 列统一表达
3. `status` 列统一用 CHECK 约束枚举
4. 所有表 `IF NOT EXISTS`（幂等建表）
5. `raw_html` 必须入库（修复当前置 NULL 的问题），受限源存 `raw_html_snippet`

## 3. 缺失值语义（is_known 四态）

| is_known | 含义 | 表格对应写法 | 前端渲染 |
|---|---|---|---|
| `known` | 已确认值 | 正常值 | 正常显示 |
| `unknown` | 未采集到 | 空 / "未知" | 灰色"待确认" |
| `na` | 不适用 | "——" | 横杠 |
| `none` | 明确没有 | "无" | 文字"无" |

```sql
is_known TEXT DEFAULT 'unknown' CHECK(is_known IN ('known','unknown','na','none')),
```

## 4. 合规字段（强制）

```sql
compliance_level TEXT DEFAULT 'safe' CHECK(compliance_level IN ('safe','attribution','restricted')),
```
- `safe`：政府源，可存正文片段（raw_html_snippet）
- `attribution`：需标注来源（默认）
- `restricted`：受限源（军队人才网），**不存 raw_html，只存标题/URL/时间**

每条记录必须可追溯：`source`（来源全名）+ `source_url`（采集 URL）+ `crawled_at`（采集时间）。

## 5. Schema 版本管理

- 主 schema 文件：`database/schema-d1.sql`（唯一权威，全量建表）
- **迁移**：新增 `database/migrations/` 目录，按时间戳命名 `20260819_01_add_exam_fields.sql`，只含增量 DDL（ALTER TABLE）
- 禁止直接改线上已存在表结构而不出迁移文件
- schema 变更必须同步更新 `docs/database/schema.md`（文档地图登记）

## 6. 数据导入规范

- 导入 SQL 由 `crawlers/generate-import-sql.js` 生成（幂等 `INSERT OR IGNORE`）
- 必须包含 `url_hash` 做去重（已实现 ✅）
- **raw_html 必须导入**（修复 `'NULL' /* raw_html 太大 */` 问题），受限源导入 snippet
- `crawled_at` 必须是真实爬取时间（修复当前统一当前时间问题），由爬虫生成
- 导入前 TRUNCATE/清空旧表需先备份（`CREATE TABLE backup AS SELECT * FROM announcements`）

## 7. 查询规范（Workers 内）

- 全部参数绑定，禁止拼接
- 排序白名单（防注入）
- `LIKE` 通配符转义：`ESCAPE '\'`
- 分页：`LIMIT ? OFFSET ?` + COUNT
- 返回映射：snake_case → camelCase 统一在 `lib/db.js` 完成

## 8. 索引规则

```sql
-- 常用筛选列必须建索引
CREATE INDEX IF NOT EXISTS idx_announcements_region ON announcements(region);
CREATE INDEX IF NOT EXISTS idx_announcements_exam_type ON announcements(exam_type);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_date ON announcements(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_exam_name ON announcements(exam_name);
CREATE INDEX IF NOT EXISTS idx_announcements_exam_stage ON announcements(exam_stage);
```

- 索引命名 `idx_<table>_<col>`
- 复合索引用于高频组合筛选（如 region + exam_stage）

## 9. 提交/验收清单

- [ ] schema 幂等（可重复执行）
- [ ] 所有新表有唯一键 + 索引
- [ ] `is_known`/`compliance_level` 列在相关表存在
- [ ] 迁移文件按 `database/migrations/` 规范命名
- [ ] 导入 SQL 含 raw_html/snippet + 真实 crawled_at
- [ ] `docs/database/schema.md` 已同步
