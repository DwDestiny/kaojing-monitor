# 技术栈调研

## 调研目标

为考情监测系统第一版（纯展示站）选择合适的技术栈。

## 关键约束

1. **现有资源**：Cloudflare 账号
2. **部署成本**：尽量使用免费额度
3. **开发效率**：快速 MVP 上线
4. **维护成本**：爬虫稳定性、异常处理

---

## 决策点 1：整体架构模式

### 方案 A：Serverless（推荐）
**架构**：Cloudflare Workers + Pages + D1/KV
- ✅ 零服务器维护成本
- ✅ 全球 CDN 加速
- ✅ 免费额度充足（Workers 10万次/天，D1 5GB）
- ✅ 天然适配定时任务（Cron Triggers）
- ⚠️ Workers 执行时长限制（CPU 10ms/50ms）
- ⚠️ D1 还在 Beta（但已稳定）

**适用场景**：轻量级爬取 + 静态展示

### 方案 B：传统服务器
**架构**：VPS + Node.js/Python + PostgreSQL
- ✅ 无执行时长限制
- ✅ 生态成熟
- ❌ 需要运维
- ❌ 成本高（最低 $5/月）

**结论**：第一版选 **方案 A（Serverless）**，成本低、部署快

---

## 决策点 2：爬虫技术

### 核心挑战
政府网站特点：
- 多为服务端渲染（SSR），部分有 JS 渲染
- 格式不统一，需要针对性解析
- 反爬：IP 限制、User-Agent 检测

### 方案对比

| 方案 | 优势 | 劣势 | 成本 |
|------|------|------|------|
| **Puppeteer/Playwright** | 处理 JS 渲染，模拟真实浏览器 | 资源消耗大，Serverless 不适用 | 需独立服务器 |
| **Cheerio + Axios** | 轻量，适合 SSR 页面 | 无法处理 JS 渲染 | 免费 |
| **混合方案** | SSR 用 Cheerio，JS 渲染用 Browserless API | 灵活 | Browserless 有免费额度 |

**推荐**：
- **第一版**：Cheerio + Axios（政府网站多为 SSR）
- **后续**：遇到 JS 渲染站点再接入 Browserless

---

## 决策点 3：数据库

### Cloudflare D1（推荐）
- SQLite 兼容
- 免费额度：5GB 存储，500万次读/天
- 与 Workers 无缝集成
- **适合**：结构化公告数据

### Cloudflare KV
- Key-Value 存储
- 免费额度：1GB，10万次读/天
- **适合**：缓存、配置

**方案**：
- D1 存公告数据
- KV 存网站配置、去重哈希

---

## 决策点 4：前端技术

### 方案 A：Next.js（App Router）
- ✅ SSG/ISR 支持，SEO 友好
- ✅ 可部署到 Cloudflare Pages
- ✅ React 生态丰富
- ⚠️ 打包体积较大

### 方案 B：纯静态站（HTML + Alpine.js）
- ✅ 极致轻量
- ✅ 秒级部署
- ❌ 交互复杂时开发效率低

**推荐**：**Next.js**（开发效率 > 性能优化）

---

## 决策点 5：定时任务

### Cloudflare Cron Triggers
- 免费
- 直接触发 Worker
- 最小间隔 1 分钟

**方案**：
- 每小时执行一次爬取任务
- 每天凌晨执行全量校验

---

## 最终技术栈（第一版）

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | Next.js (App Router) | SSG 部署到 Cloudflare Pages |
| **后端** | Cloudflare Workers | API + 爬虫调度 |
| **数据库** | Cloudflare D1 (主) + KV (缓存) | 公告数据 + 去重 |
| **爬虫** | Cheerio + Axios | 轻量级 HTML 解析 |
| **定时任务** | Cron Triggers | 每小时爬取 |
| **部署** | Cloudflare Pages | 全球 CDN |

---

## 成本预估

### 免费额度内可支撑规模
- Workers：10万次请求/天 → **约 4000 次/小时**
- D1：500万次读/天 → **充足**
- Pages：无限请求

### 突破免费额度后（按需升级）
- Workers Paid：$5/月起
- D1：按量付费

**结论**：第一版完全在免费额度内

---

## 风险与预案

### 风险 1：Workers CPU 时长限制
- **现象**：单次爬取超时
- **预案**：拆分任务，每次 Worker 只爬 1-2 个站点

### 风险 2：IP 被封
- **现象**：政府网站封 Cloudflare IP
- **预案**：接入代理池（如 Bright Data 免费额度）

### 风险 3：D1 稳定性
- **现象**：Beta 阶段可能有 bug
- **预案**：定期导出备份到 KV 或 R2

---

## 下一步

- [ ] 数据库 Schema 设计
- [ ] API 接口设计
- [ ] 爬虫规则设计
- [ ] 前端原型设计
