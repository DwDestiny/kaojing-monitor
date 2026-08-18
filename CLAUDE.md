# 考情监测系统 - 项目文档

## 项目概述

**产品定位**：事业单位招考信息自动化监测与展示平台

**核心价值**：
- 自动爬取全网招考公告，解放手动查询时间
- 结构化展示，支持多维度筛选
- 建立考情信息资产库

**线上地址**：
- 前端：https://kaojing-monitor.pages.dev
- API：https://kaojing-api.dangwei121105.workers.dev
- 仓库：https://github.com/DwDestiny/kaojing-monitor

---

## 技术栈（已定）

### 后端
- **Workers API**：Cloudflare Workers（原生 fetch 路由，单文件 `api/src/index.js`）
- **数据库**：Cloudflare D1（SQLite）
- **定时任务**：Cloudflare Cron Triggers（每天 2:07 和 14:23）
- **部署**：`wrangler deploy`（`cd api && wrangler deploy`）

### 前端
- **框架**：Next.js 14.2.35（静态导出 `output: 'export'`）
- **样式**：Tailwind CSS + OKLCH 色彩空间
- **部署**：Cloudflare Pages（GitHub 自动构建）

### 数据采集
- **通用爬虫引擎**：`api/src/crawler/engine.js`
- **网站配置**：JSON 配置驱动，8 个数据源（山东、江苏、福建、天津、新疆、北京、广东人社厅）
- **翻页模式**：4 种（URL 模式、点击、滚动、无翻页）

---

## 目录结构

```
/api                    # Cloudflare Workers 后端
  /src
    index.js            # Workers 入口：路由（公告/统计/地区/反馈）+ Cron 调度
  wrangler.toml         # Workers 配置（D1 绑定、Cron 表达式）
  schema.sql            # D1 数据库 Schema

/frontend               # Next.js 前端
  /app                  # App Router 路由
  /components           # React 组件
  /lib                  # API 客户端、工具函数
  next.config.mjs       # Next.js 配置（静态导出 + API URL）
  tailwind.config.ts    # Tailwind 配置（OKLCH 色彩）

/.github/workflows      # GitHub Actions（预留，暂未启用）
/wrangler.toml          # 已删除（Pages 不支持根目录 wrangler.toml）
```

---

## 部署架构

### 后端（Workers）
1. 本地开发：`cd api && wrangler dev`
2. 部署：`cd api && wrangler deploy`
3. D1 数据库：
   - 名称：`kaojing-db`
   - ID：`6ddc90cf-ea1b-4b67-b095-7d545b8fb851`
   - 初始化：`wrangler d1 execute kaojing-db --file=schema.sql`
4. 定时任务：每天 2:07（凌晨）和 14:23（下午）自动爬取

### 前端（Pages）
1. 本地开发：`cd frontend && npm run dev`
2. 本地构建：`npm run build`（输出到 `out/`）
3. 部署：GitHub push 到 `main` 分支 → CF Pages 自动构建
4. 环境变量：**无需在 Dashboard 设置**（API URL 已硬编码在 `lib/api.ts`）

---

## 当前状态与问题

### ✅ 已完成
- [x] 后端 API 全部正常（stats、公告列表、公告详情、地区列表）
- [x] D1 数据库已导入 1424 条公告 + 126 个网站配置
- [x] 前端静态导出成功并部署（commit `a5b6a7b`）
- [x] 线上 404 问题已解决（详见下方「排查记录」）
- [x] 后端支持科目筛选（`examCategory`）和排序（`sortBy`/`sortOrder`）

### ⚠️ 待处理
- [ ] GitHub Actions workflow 已改为手动触发（备用通道），如需启用需配置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets
- [ ] 后端新参数（`examCategory` / `sortBy` / `sortOrder`）及 AI 端点需重新部署 Worker 生效：`cd api && wrangler deploy`
- [ ] about 页「提交新网站」表单待实现（当前为占位文案）
- [ ] AI 端点本地/线上联调验证（`/api/ai/classify`、`/api/ai/extract`，Workers AI `@cf/meta/llama-3.2-3b-instruct`）

---

## 🐛 404 问题排查记录（2026-08-17 19:00 - 22:00）

**现象**：CF Pages 部署成功，但前端显示"请求失败 (404)"

**排查过程**：
1. **环境变量方案（失败）**：在 CF Pages Dashboard 设置 `NEXT_PUBLIC_API_BASE_URL` → 发现环境变量不会注入到 `npm run build`
2. **next.config.mjs env 字段（失败）**：添加 `env: { NEXT_PUBLIC_API_BASE_URL: '...' }` → `process.env` 在构建时仍为空
3. **硬编码 API URL（正确方案）**：修改 `lib/api.ts` 的 `getApiBase()`，浏览器环境直接返回完整 Workers URL（commit `fb2aef0`）
4. **误判为"未解决"**：curl 测试确认生产环境 bundle 已包含 API URL，但用户截图仍显示 404

**根因定位（2026-08-17 22:00）**：

用户访问的是 **CF Pages 预览部署 URL**（`https://394512bf.kaojing-monitor.pages.dev`），而非生产 URL（`https://kaojing-monitor.pages.dev`）。

| | 预览部署（旧版） | 生产部署（新版） |
|---|---|---|
| URL | `394512bf.kaojing-monitor.pages.dev` | `kaojing-monitor.pages.dev` |
| bundle 来源 | 旧 commit（无硬编码 API URL） | 最新 commit（含硬编码 API URL） |
| API 请求 | 相对路径 `/api/*` → 404 | 绝对路径 `kaojing-api...workers.dev` → 200 |
| 验证结果 | curl 检查 0 次出现 `dangwei121105` | curl 检查 847 chunk 中包含完整 URL |

**解决方案**：
- 用户使用生产 URL（`kaojing-monitor.pages.dev`）即可正常访问
- （可选）在 CF Pages Dashboard 禁用 Preview deployments 避免混淆

**经验教训**：
1. CF Pages 预览部署和生产部署是**完全独立的 bundle**，预览域名不会自动使用生产环境最新代码
2. 排查 404 时**首先确认用户访问的 URL**（不要假设是生产域名）
3. `fetchStats().catch(() => MOCK_STATS)` 会静默吞掉错误并显示 mock 数据（1243），掩盖真实 API 失败
4. CF Pages Dashboard 的环境变量**只对 Pages Functions（运行时）生效**，不会注入到 `npm run build` 构建阶段

---

## 关键文件说明

### `frontend/lib/api.ts`
API 客户端，核心函数 `getApiBase()` 返回 API 基础 URL：
- **浏览器环境**：硬编码返回 `https://kaojing-api.dangwei121105.workers.dev`
- **本地开发服务端**：返回 `http://127.0.0.1:8787`
- **不依赖环境变量**（CF Pages Dashboard 的环境变量不会注入到 `npm run build`）

### `frontend/next.config.mjs`
Next.js 配置：
- `output: 'export'`：静态导出模式
- `env.NEXT_PUBLIC_API_BASE_URL`：环境变量配置（实际未生效，已改为硬编码）

### `api/wrangler.toml`
Workers 配置：
- D1 数据库绑定
- Cron 表达式（非整点，避开流量高峰）
- 运行时环境变量（`ENVIRONMENT = "production"`）

---

## 文档维护

- **项目文档**：本文件（`CLAUDE.md`）
- **API 文档**：`api/README.md`（待补充）
- **前端文档**：`frontend/README.md`（待补充）
- **Wiki**：`/Users/dw/wiki/entities/kaojing-monitor.md`（待创建）

---

## 变更记录

- 2026-08-17 21:55：404 问题排查结案——线上已恢复正常，根因=早期 bundle 未硬编码 API URL；后端补全 examCategory/sortBy/sortOrder 参数；GitHub Actions 改手动触发防双通道
- 2026-08-17 21:40：项目文档系统性整理（GEB L1）
- 2026-08-17 21:33：前端改为硬编码 API URL（commit `fb2aef0`）
- 2026-08-17 21:29：前端 `next.config.mjs` 添加 env 配置（commit `56effba`）
- 2026-08-17 19:29：前端转静态导出（commit `7740e86`）
- 2026-08-17 14:30：后端 API 部署完成，D1 数据导入
- 2026-08-17：项目启动，需求分析完成
