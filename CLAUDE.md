# 考情监测系统 - 项目文档

## 项目概述

**产品定位**：事业单位招考信息自动化监测与展示平台

**核心价值**：
- 自动爬取全网招考公告，解放手动查询时间
- 结构化展示，支持多维度筛选
- 建立考情信息资产库

**线上地址**：
- 前端：https://kaojing-monitor.pages.dev
- API：https://kaojing-monitor.pages.dev/api（2026-08-20 起由 Pages Functions 提供同域 API；旧 workers.dev API 已停用——国内被 GFW 封锁）
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
- **通用爬虫引擎**：`crawlers/core/engine.js`（P1 扩展：GBK 解码/pageOffset 页码偏移/offset 参数分页/日期拆分拼接/无日期兜底）
- **网站配置**：`crawlers/config/sites.json`，**28 个源（25 启用 + 3 备用）**：山东、江苏、福建、天津、新疆(2)、北京(2)、广东、上海、重庆、贵州、湖北、湖南、河南、四川、云南、广西、山西、内蒙古、吉林、辽宁、海南、宁夏、全国事业单位招聘网等
- **禁用源**（需 API 模式适配）：浙江（jcms JS 渲染）、河北（Vue SPA）、黑龙江（无招聘专版）
- **翻页模式**：4 种（static-file / url-param / single / hybrid）+ pageOffset / paginationParamName / paginationStep 扩展

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

## 当前状态与问题（2026-08-19 14:10 更新）

### 🔴 待办事项（评审后执行）
1. **字段提取链路重构**（P0，方案见 `OPTIMIZATION_PLAN_V2.md` 阶段1）：
   - `/api/ai/extract` 改 JSON Mode + 全字段 schema（当前 llama-3.2-3b 不在 JSON Mode 支持列表，需换 qwen3-30b-a3b-fp8 或 llama-3.1-8b-instruct-fp8-fast）
   - `process.js` 改"规则优先 + AI 补缺 + 置信度审计"，修复 hasValidData 恒真短路
   - `generate-import-sql.js` 让 raw_html 入库（当前显式置 NULL，导致无法离线重提）
   - 离线重提取 139 条并重新导入 D1
2. **自动化链路接通**（P0，阶段2）：crawler.yml 补 Upload D1 步骤 + GitHub secrets 配置；Workers scheduled() 补触发逻辑
3. **前端假数据清理**（P1，阶段3）：stats 补真实字段；科目选项从数据派生（新增 /api/subjects）；去掉 MOCK 兜底
4. **安全与治理**（P2，阶段4）：AI 端点加 Bearer token；pageSize 上限；LIKE 转义；CORS 收窄；死代码清理；git 提交；文档统一
5. **需求升级**（依据辅导员在用 Excel 分析，见 `docs/REQUIREMENTS_V2.md`）：从"公告聚合"升级为"考情咨询工作台"，数据模型对齐表格 20 组维度

### ✅ 已完成
- [x] 后端 API 全部正常（stats、公告列表、公告详情、地区列表）
- [x] 前端静态导出成功并部署，线上 404 问题已解决
- [x] 后端支持科目筛选（`examCategory`）和排序（`sortBy`/`sortOrder`）
- [x] **过滤系统重构**（PR #10，commit `e87d30d`）：完全移除 AI classify，改为纯规则三级过滤（黑名单50+词 → 白名单 → 拒绝），垃圾数据拦截率 100%
- [x] D1 数据库现存 **139 条干净招考公告**（旧脏数据已清空，重新爬取导入）
- [x] Wrangler 升至 v4.124.0（修复 D1 import 认证失败 [code: 10000]）
- [x] `generate-import-sql.js` 修复 `examSubjects.join is not a function`（加 `Array.isArray` 判断）
- [x] **全案诊断完成**（2026-08-19）：出具 `OPTIMIZATION_PLAN_V2.md`，含 P0-P2 缺陷链证据 + 业界调研（结构化输出谱系/JSON Mode/模型成本核算 qwen3-30b 不超额）
- [x] **辅导员考情汇总表分析完成**（2026-08-19）：42 sheet / 6万+行，产出 `docs/REQUIREMENTS_V2.md`

### 🔴 阻塞问题定位记录：所有字段显示"待定"（已诊断，待修复）
**现象**：线上所有公告的 `examDate`、`registrationDeadline`、`examType` 等字段全部为 null，前端显示"待定"。

**根因**（已定位 + 线上实测确认）：

`crawlers/process.js` 的 `extractAnnouncements()` 逻辑缺陷——

```
AI extract 调用 → 返回 {recruitCount, examSubjects, confidence}
                  （AI 提示词只要求提取这两个字段，examDate/registrationDeadline 根本没问）
AI hasValidData 判断：recruitCount!=null || examSubjects.length>0 || examDate!=null
                  → AI 几乎总返回 recruitCount + 科目 → 恒为 true
usedAI = true → 规则兜底 ruleExtractFields() 永远不执行
finalFields = {recruitCount, examSubjects} ← examDate 根本不在里面
D1 里全是 NULL（线上 stats byExamType 实测 139 条全 null）
```

**额外数据可信度问题**：AI 返回的 examSubjects 高度模板化（139 条几乎全"综合应用能力A类,职业能力倾向测验"，连江苏三支一扶也如此）→ 3B 模型幻觉套模板，recruitCount 可信度同样存疑。

**额外确认**：规则提取器 `crawlers/core/extractor.js` 的 `extractFields()` 工作正常：
- `registrationDeadline`：72/139（52%）
- `examDate`：13/139（9%）

- `recruitCount`：60/139（43%）

**待决策**：修复方向需确认（见下方「待决策事项」）

### ⚠️ 待处理
- [ ] **字段提取修复**（最高优先级，阻塞线上体验）——见「待决策事项」
- [ ] GitHub Actions workflow 已改为手动触发（备用通道），如需启用需配置 secrets
- [ ] about 页「提交新网站」表单待实现（当前为占位文案）

### 🤔 待决策事项

**字段提取方案选择**（2026-08-19 等待确认）：

| 方案 | 说明 | 优点 | 风险 |
|---|---|---|---|
| A：扩展 AI prompt | 把 examDate/registrationDeadline/examType 等加进 AI 提示词，让 llama-3.2-3b 统一提取所有字段 | 纯 AI，理论上能理解非结构化文本 | 3B 小模型提取日期可靠性未知；每条都调 AI，速度慢 |
| B：混合方案 | AI 提取 recruitCount+examSubjects，规则提取日期字段，两个结果合并 | 各取所长，覆盖更全，规则提日期稳定 | 逻辑稍复杂 |
| C：纯规则 | 完全移除 AI extract，全用规则提取器 | 最简单最快最稳定 | 无法处理格式不规则的文本 |

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
- **浏览器环境**：返回空串 `""` → 同域相对路径 `/api/*`（Pages Functions 提供 API，同源免 CORS）
- **本地开发服务端**：返回 `http://127.0.0.1:8787`
- **不依赖环境变量**（CF Pages Dashboard 的环境变量不会注入到 `npm run build`）

### `functions/`（仓库根，2026-08-20 新增）
Cloudflare Pages Functions：12 个 API 端点文件路由（薄封装复用 `api/src/index.js` 的 handler）。
- 约定位置：**仓库根 /functions**（Pages Git 集成按项目根查找；若放 frontend/ 下 Git 集成识别不到 → /api 404）
- 根 `wrangler.toml`：Pages 项目 bindings（D1/AI/vars），Git 集成构建自动应用
- 部署通道：Git 集成（push 自动构建部署），**唯一通道**（勿用 wrangler pages deploy 双通道覆盖）
- Secrets：AI_API_TOKEN 用 `wrangler pages secret put AI_API_TOKEN --project-name=kaojing-monitor` 配置（不落 git）

### `frontend/next.config.mjs`
Next.js 配置：
- `output: 'export'`：静态导出模式

### `api/wrangler.toml`
Workers 配置：
- D1 数据库绑定
- Cron 表达式（非整点，避开流量高峰）
- 运行时环境变量（`ENVIRONMENT = "production"`）

---

## 🐛 字段提取问题记录（2026-08-18 ~ 2026-08-19）

### 坑 #1：垃圾数据进入 D1（已修复，PR #10）

**时间**：2026-08-18

**现象**：D1 里出现"北京市职业技能鉴定中心关于变更办公地址的通告"等无关公告。

**根因**：
- `filterAnnouncements()` 依赖 `callWorkerAI('classify', ...)` 判断是否招考公告
- llama-3.2-3b 分类不稳定，大量无关内容被判断为 `is_recruitment: true`
- catch 块默认保留（pass-through），AI 失败时也放行
- 黑名单词汇太少，不足以兜底

**修复**（PR #10，commit `e87d30d`）：
- 完全移除 AI classify
- 改为三级纯规则：黑名单50+词直接拒绝 → 白名单命中且无负面词通过 → 其余全拒绝
- 黑名单扩充：变更地址/证书发放/面试通知/资格复审/公示名单/招聘会/人才夜市 等

---

### 坑 #2：Wrangler v3 D1 import 认证失败（已修复）

**时间**：2026-08-18

**现象**：`wrangler d1 import` 报错 `[code: 10000]`，认证失败无法导入数据。

**根因**：Wrangler 3.x 对 D1 import API 的认证方式与当前 CF API 不兼容。

**修复**：`api/package.json` 中 wrangler 从 `^3.0.0` 升级到 `^4.124.0`。

---

### 坑 #3：`examSubjects.join is not a function`（已修复）

**时间**：2026-08-18

**现象**：`node generate-import-sql.js` 报错崩溃。

**根因**：某些条目的 `examSubjects` 字段是字符串而不是数组，直接调 `.join()` 报错。

**修复**（`crawlers/generate-import-sql.js` 第37行）：
```javascript
// 修复前
item.examSubjects?.length > 0 ? escapeSql(item.examSubjects.join(',')) : 'NULL'
// 修复后
Array.isArray(item.examSubjects) && item.examSubjects.length > 0
  ? escapeSql(item.examSubjects.join(','))
  : (typeof item.examSubjects === 'string' && item.examSubjects ? escapeSql(item.examSubjects) : 'NULL')
```

---

### 坑 #4：AI extract 只提 2 个字段，但误判为"成功"（当前阻塞，未修复）

**时间**：2026-08-19

**现象**：线上所有公告 `examDate`、`registrationDeadline`、`examType` 全为 null，显示"待定"。

**根因链**：
1. `/api/ai/extract` 端点的提示词只要求返回 `{recruitCount, examSubjects, confidence}`，从未设计提取日期字段
2. `extractAnnouncements()` 的 `hasValidData` 判断：`examSubjects.length > 0` 几乎总为 true（AI 总返回默认科目）
3. 所以 `usedAI = true`，规则兜底 `ruleExtractFields()` 永远不执行
4. `finalFields` 里没有 `examDate` / `registrationDeadline`，写入 D1 时全是 NULL

**验证数据**（规则提取器实测，139 条数据）：
- `registrationDeadline` 有值：72/139（52%）
- `examDate` 有值：13/139（9%）
- `recruitCount` 有值：60/139（43%）

**待决策**：见「待决策事项」

---

## 爬虫关键文件说明

### `crawlers/process.js`
数据处理主流程：爬取 → 过滤 → 去重 → 详情页抓取 → 字段提取 → 输出 JSON

关键函数：
- `filterAnnouncements()`：纯规则三级过滤（黑名单/白名单），PR #10 后已稳定
- `extractAnnouncements()`：⚠️ 当前有缺陷，AI extract 只提2字段但误判成功，导致日期字段全空

### `crawlers/core/extractor.js`
规则字段提取器，`extractFields()` 输出：
- `recruitCount`：正则提取招聘人数
- `examDate`：正则提取考试日期
- `examTime`：考试时间
- `examSubjects`：考试科目（从标题/内容匹配）
- `examType`：分类（`classifyExamType()`）
- `registrationDeadline`：报名截止日期
- `examLocation`：考试地点
- `salaryRange`：薪资范围

### `crawlers/output/processed-data.json`
当前 139 条干净数据，含 `rawHtml` 字段（用于重新提取，不需要重爬）。

---

## 文档维护

- **项目文档**：本文件（`CLAUDE.md`）
- **API 文档**：`api/README.md`（待补充）
- **前端文档**：`frontend/README.md`（待补充）
- **Wiki**：`/Users/dw/wiki/entities/kaojing-monitor.md`

---

## 变更记录

- 2026-08-20（P1 扩源，`0ffbb49`+）：数据源 8→28（25 启用）、engine 扩展（GBK/pageOffset/offset 分页/日期拼接/defaultDate）、schema 迁移 18 列+4 新表（已执行线上 D1）、合规分级（complianceLevel+Footer 免责声明）、is_known 四态；GH Actions 实测 21/25 源自动入库 68 条新数据；UA 改浏览器修复 WAF 403/418；已知限制：四川/山西/内蒙古/海南/qgsydw 5 源海外 runner 不可达（本地中国网络正常）
- 2026-08-19 13:00：文档系统性更新——补录字段提取问题根因、历史踩坑 #2/#3/#4、爬虫文件说明
- 2026-08-18（PR #10，`e87d30d`）：过滤系统重构——纯规则替换 AI 分类，黑名单扩充50+词
- 2026-08-18：Wrangler 升至 v4.124.0，修复 D1 import 认证失败
- 2026-08-18：`generate-import-sql.js` 修复 `examSubjects.join is not a function`
- 2026-08-18：清空旧脏数据，重新爬取并导入 139 条干净公告
- 2026-08-17 21:55：404 问题排查结案——线上已恢复正常，根因=早期 bundle 未硬编码 API URL；后端补全 examCategory/sortBy/sortOrder 参数；GitHub Actions 改手动触发防双通道
- 2026-08-17 21:40：项目文档系统性整理（GEB L1）
- 2026-08-17 21:33：前端改为硬编码 API URL（commit `fb2aef0`）
- 2026-08-17 19:29：前端转静态导出（commit `7740e86`）
- 2026-08-17 14:30：后端 API 部署完成，D1 数据导入
- 2026-08-17：项目启动，需求分析完成
