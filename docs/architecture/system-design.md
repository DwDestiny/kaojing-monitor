# 系统架构设计

## 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         用户浏览器                            │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Pages (静态前端)                      │
│  - Next.js SSG 生成的静态 HTML                                │
│  - 公告列表、筛选、详情页                                      │
│  - 用户提交表单                                               │
└────────────────────┬────────────────────────────────────────┘
                     │ API 调用
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Cloudflare Workers (API + 爬虫)                    │
│                                                               │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │   API Router    │  │  Crawler Engine  │                  │
│  │  - GET /api/    │  │  - 定时触发      │                  │
│  │    announcements│  │  - 网站爬取      │                  │
│  │  - POST /api/   │  │  - 数据解析      │                  │
│  │    submissions  │  │  - 去重入库      │                  │
│  └─────────────────┘  └──────────────────┘                  │
│           │                      │                            │
│           └──────────┬───────────┘                            │
└──────────────────────┼────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│  Cloudflare D1   │      │  Cloudflare KV   │
│  (SQLite 数据库)  │      │  (缓存 + 去重)    │
│  - announcements │      │  - url_hash      │
│  - source_websites│      │  - config cache  │
│  - submissions   │      │  - crawl_queue   │
│  - crawl_logs    │      └──────────────────┘
└──────────────────┘
```

---

## 模块详细设计

### 1. 前端模块 (Next.js)

#### 页面结构
```
/                          首页（最新公告）
/announcements             公告列表（支持筛选）
/announcements/[id]        公告详情
/submit                    用户提交新网站
/about                     关于页面
```

#### 数据获取策略
- **SSG (Static Site Generation)**：每小时重新构建一次
- **ISR (Incremental Static Regeneration)**：按需更新单个页面
- **Client-side Fetching**：筛选器实时查询

#### 关键组件
- `AnnouncementCard`: 公告卡片
- `FilterPanel`: 筛选面板（地区/类型/时间）
- `SubmitForm`: 用户提交表单
- `AdminPanel`: 管理后台（审核提交）

---

### 2. API 模块 (Cloudflare Workers)

#### 路由设计

##### GET /api/announcements
获取公告列表（支持筛选）

**Query 参数**：
```typescript
{
  region?: string;          // 地区
  examType?: string;        // 考试类型
  examCategory?: string;    // 科目类别
  startDate?: string;       // 开始日期
  endDate?: string;         // 结束日期
  page?: number;            // 页码
  pageSize?: number;        // 每页条数（默认 20，最大 100）
  sortBy?: 'publish_date' | 'exam_date';  // 排序字段
  sortOrder?: 'asc' | 'desc';  // 排序方向
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "title": "新疆兵团第五师双河市2026年高校毕业生"三支一扶"计划招募公告",
        "url": "http://...",
        "recruitCount": 49,
        "examSubjects": ["职业能力倾向测验", "综合应用能力"],
        "examDate": "2026-07-12",
        "examTime": "10:00-12:30",
        "region": "新疆",
        "examType": "三支一扶",
        "publishDate": "2026-06-29"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 156,
      "totalPages": 8
    }
  }
}
```

---

##### GET /api/announcements/:id
获取公告详情

**响应**：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "...",
    "url": "...",
    "recruitCount": 49,
    "examSubjects": ["职测", "综合"],
    "examDate": "2026-07-12",
    "examTime": "10:00-12:30",
    "region": "新疆",
    "examType": "三支一扶",
    "publishDate": "2026-06-29",
    "crawledAt": "2026-06-29T15:30:00Z",
    "sourceWebsite": {
      "id": 1,
      "name": "新疆兵团人事考试网"
    }
  }
}
```

---

##### GET /api/stats
获取统计数据（首页展示）

**响应**：
```json
{
  "success": true,
  "data": {
    "totalAnnouncements": 1243,
    "newToday": 12,
    "newThisWeek": 68,
    "upcomingExams": 23,
    "regionStats": {
      "新疆": 156,
      "北京": 89,
      "上海": 67
    },
    "examTypeStats": {
      "三支一扶": 234,
      "事业单位": 567,
      "教师招聘": 442
    }
  }
}
```

---

##### POST /api/submissions
用户提交新网站

**请求体**：
```json
{
  "websiteUrl": "http://example.gov.cn/notices",
  "websiteName": "某地人事考试网",
  "contact": "example@email.com",
  "note": "这个网站经常发布三支一扶信息"
}
```

**响应**：
```json
{
  "success": true,
  "message": "提交成功，我们会尽快审核"
}
```

**校验规则**：
- URL 格式有效
- 同一 IP 24小时内最多提交 3 次
- 同一 URL 不能重复提交

---

##### GET /api/filters/options
获取筛选器可选项（动态）

**响应**：
```json
{
  "success": true,
  "data": {
    "regions": ["新疆", "北京", "上海", "广东", ...],
    "examTypes": ["三支一扶", "事业单位", "教师招聘", ...],
    "examCategories": ["职测", "公基", "综合", "专业知识"]
  }
}
```

---

### 3. 爬虫模块

#### 架构

```typescript
// 核心接口
interface Crawler {
  crawl(website: SourceWebsite): Promise<CrawlResult>;
}

// 爬虫工厂
class CrawlerFactory {
  static create(type: 'cheerio' | 'puppeteer'): Crawler {
    // 根据类型返回对应爬虫实例
  }
}

// 调度器
class CrawlerScheduler {
  async run() {
    // 1. 从数据库获取 active 状态的网站
    // 2. 按优先级排序（上次成功时间、重要性）
    // 3. 逐个爬取（避免并发过多导致超时）
    // 4. 记录日志
    // 5. 更新网站状态
  }
}
```

#### Cheerio 爬虫实现

```typescript
class CheerioCrawler implements Crawler {
  async crawl(website: SourceWebsite): Promise<CrawlResult> {
    const config = JSON.parse(website.selector_config);
    
    // 1. 请求列表页
    const listHtml = await fetch(website.list_url).then(r => r.text());
    const $ = cheerio.load(listHtml);
    
    // 2. 提取公告链接
    const links: string[] = [];
    $(config.list.container).find(config.list.item).each((i, el) => {
      const url = $(el).find(config.list.url).attr('href');
      links.push(new URL(url, website.base_url).href);
    });
    
    // 3. 检查 URL 是否已存在（KV 去重）
    const newLinks = await this.filterNewUrls(links);
    
    // 4. 爬取详情页
    const announcements = [];
    for (const url of newLinks) {
      const detail = await this.crawlDetail(url, config.detail);
      if (detail) announcements.push(detail);
    }
    
    // 5. 批量插入数据库
    await this.saveAnnouncements(announcements);
    
    return {
      newCount: announcements.length,
      totalChecked: links.length
    };
  }
  
  private async crawlDetail(url: string, config: any) {
    const html = await fetch(url).then(r => r.text());
    const $ = cheerio.load(html);
    
    return {
      title: $(config.title).text().trim(),
      url,
      recruitCount: this.extractByRegex(html, config.recruitCount),
      examSubjects: this.extractByRegex(html, config.examSubjects),
      examDate: this.extractByRegex(html, config.examDate),
      // ...
    };
  }
}
```

#### 定时任务配置

```toml
# wrangler.toml
[triggers]
crons = ["0 * * * *"]  # 每小时执行一次
```

#### 错误处理策略

```typescript
class CrawlerScheduler {
  async crawlWithRetry(website: SourceWebsite) {
    const MAX_RETRIES = 3;
    let lastError;
    
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        return await this.crawler.crawl(website);
      } catch (error) {
        lastError = error;
        await this.sleep(1000 * (i + 1));  // 指数退避
      }
    }
    
    // 连续失败，更新状态
    await this.handleCrawlFailure(website, lastError);
  }
  
  async handleCrawlFailure(website: SourceWebsite, error: Error) {
    const errorCount = website.error_count + 1;
    
    // 连续失败 5 次，自动暂停
    const newStatus = errorCount >= 5 ? 'failed' : 'active';
    
    await db.update(source_websites)
      .set({
        error_count: errorCount,
        error_message: error.message,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .where({ id: website.id });
    
    // 记录日志
    await this.logCrawlResult(website.id, 'failed', error);
  }
}
```

---

### 4. 数据处理流程

#### 去重策略

```typescript
async function isDuplicate(url: string): Promise<boolean> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(url)
  );
  const hashHex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // 检查 KV
  const existing = await env.KV.get(`url_hash:${hashHex}`);
  return existing !== null;
}

async function markAsProcessed(url: string, announcementId: number) {
  const hash = /* 同上 */;
  await env.KV.put(`url_hash:${hash}`, announcementId.toString(), {
    expirationTtl: 30 * 24 * 60 * 60  // 30天过期
  });
}
```

#### 信息提取（正则 + NLP）

```typescript
// 提取招考人数
function extractRecruitCount(text: string): number | null {
  const patterns = [
    /(?:招聘|招考|招募)(\d+)人/,
    /计划招聘.*?(\d+)名/,
    /共计.*?(\d+)个/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseInt(match[1]);
  }
  return null;
}

// 提取考试科目
function extractExamSubjects(text: string): string[] {
  const subjects = [];
  if (/职业能力倾向测验|职测/.test(text)) subjects.push('职测');
  if (/公共基础知识|公基/.test(text)) subjects.push('公基');
  if (/综合应用能力|综合/.test(text)) subjects.push('综合');
  return subjects;
}

// 提取考试时间
function extractExamDate(text: string): string | null {
  const pattern = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
  const match = text.match(pattern);
  if (match) {
    const [_, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}
```

---

### 5. 部署配置

#### Cloudflare Workers 配置

```toml
# wrangler.toml
name = "kaoping-monitor"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[triggers]
crons = ["0 * * * *"]  # 每小时爬取

[[d1_databases]]
binding = "DB"
database_name = "kaoping-monitor-db"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
```

#### Next.js 配置

```javascript
// next.config.js
module.exports = {
  output: 'export',  // 静态导出
  images: {
    unoptimized: true  // Cloudflare Pages 不支持 Image Optimization
  },
  env: {
    API_BASE_URL: 'https://api.kaoping-monitor.workers.dev'
  }
}
```

---

## 性能优化

### 1. 前端优化
- SSG 生成静态页面，加载快
- 图片懒加载
- 代码分割（按页面）

### 2. API 优化
- D1 查询使用索引
- KV 缓存热点数据（首页统计、筛选项）
- 分页限制（最大 100 条/次）

### 3. 爬虫优化
- 串行爬取（避免并发超时）
- 智能跳过（已爬取过的 URL）
- 增量更新（只爬最新几页）

---

## 监控与运维

### 日志记录
- 每次爬取记录到 `crawl_logs` 表
- Workers 异常通过 Sentry 上报

### 健康检查
- 每日检查失败网站（error_count > 0）
- 发送邮件通知管理员

### 备份策略
- 每天凌晨导出 D1 到 R2
- 保留最近 7 天备份

---

## 安全设计

### 防刷措施
- 用户提交：IP 限流（24h 内最多 3 次）
- API：Cloudflare WAF 规则
- 爬虫：User-Agent 轮换，请求间隔

### 数据校验
- URL 格式验证
- SQL 注入防护（使用参数化查询）
- XSS 防护（前端转义）

---

## 下一步

- [ ] 编写爬虫代码（Cheerio 版本）
- [ ] 搭建 Next.js 前端框架
- [ ] 编写 API 接口
- [ ] 配置 Cloudflare Workers 环境
- [ ] 初始化测试数据
