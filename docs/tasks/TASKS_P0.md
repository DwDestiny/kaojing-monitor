# P0 地基修复 · 任务包拆解

> 来源：`OPTIMIZATION_PLAN_V2.md` 阶段 1-4
> 开发规范：`docs/standards/` 三件套（后端/前端/数据库）——**必读**
> 文档地图：`docs/DOC_MAP.md`
> 目标：消灭幻觉数据、日期字段有值、原始数据落库、自动化接通、无假数据

---

## 任务总览

| ID | 任务 | 领域 | 改动域 | 验收标准 |
|---|---|---|---|---|
| P0-01 | API `/api/ai/extract` 重构（JSON Mode + 全字段 schema） | 后端 | `api/` | JSON Mode 生效、schema 覆盖全字段、模型可配 |
| P0-02 | `process.js` 提取逻辑重构（规则优先+AI补缺+置信度） | 爬虫 | `crawlers/` | 规则字段优先、AI 只补缺、confidence 审计 |
| P0-03 | `generate-import-sql.js` 修复（raw_html 入库） | 爬虫 | `crawlers/` | raw_html 非 NULL、crawled_at 真实 |
| P0-04 | 前端假数据清理（stats/科目/类型 + 去 MOCK） | 前端 | `frontend/` | 无生产 mock 引用、错误态正确 |
| P0-05 | 安全加固（AI 鉴权/pageSize 上限/LIKE 转义/CORS） | 后端 | `api/` | 无 token 401、pageSize 截断、LIKE 转义 |
| P0-06 | 后端路由拆分（index.js → routes/services/lib） | 后端 | `api/` | 行为不变、6 端点通过 |

---

## P0-01：API `/api/ai/extract` 重构

**目标**：从"纯提示词只提 2 字段"改为"JSON Mode + 全字段 schema"，消灭幻觉模板科目。

**改动文件**：`api/src/index.js`（或拆分后的 `api/src/routes/ai.js` + `api/src/services/extract-service.js`）

**要求**：
1. 模型改为 `config.js` 中配置：`EXTRACT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'`，fallback `EXTRACT_MODEL_FALLBACK = '@cf/meta/llama-3.1-8b-instruct-fp8-fast'`（注释说明：qwen3 不在官方 JSON Mode 列表，需实测，不兼容则用 fallback）
2. 使用 `response_format: { type: 'json_schema', json_schema: {...} }`，schema 字段（见 BACKEND_STANDARD §6）：
   - `recruitCount` (integer|null)
   - `examDate` (string|null, YYYY-MM-DD)
   - `examTime` (string|null)
   - `examSubjects` (string[], 找不到返回空数组)
   - `examType` (string|null)
   - `examLocation` (string|null)
   - `registrationDeadline` (string|null, YYYY-MM-DD)
   - `salaryRange` (string|null)
   - `confidence` (number 0-1)
   - `missingFields` (string[])
   - `warnings` (string[])
   - required: `["recruitCount","examDate","examSubjects","confidence"]`
3. 系统提示词强调：**"无把握的字段返回 null，禁止编造"**
4. 解析失败返回 `{ error, raw }` 结构化错误（保持现有 parseAiJson/extractAiText 复用）
5. 端点鉴权：检查 `Authorization: Bearer <env.AI_API_TOKEN>`，无 token 401（P0-05 协同）

**验收**：
- [ ] 请求体含 `response_format` JSON Schema（代码可查）
- [ ] schema 覆盖 8+ 提取字段 + confidence + missingFields + warnings
- [ ] 无 token 返回 401（若 P0-05 已做）
- [ ] 解析失败不 500 崩溃，返回结构化错误

---

## P0-02：`process.js` 提取逻辑重构

**目标**：修复 `hasValidData` 恒真短路——改为"规则优先 + AI 补缺 + 置信度审计"。

**改动文件**：`crawlers/process.js`（`extractAnnouncements` 函数）

**要求**：
1. 对每条公告：
   - 先 `ruleExtractFields(item)`（已有规则提取器，验证过日期 52%/人数 94%）
   - 再调 `callWorkerAI('extract', ...)` 拿 AI 结果
   - 合并：**规则字段优先**，AI 只补规则缺失的字段：
     ```javascript
     const finalFields = {
       ...aiFields,
       recruitCount: ruleFields.recruitCount ?? aiFields.recruitCount,
       examDate: ruleFields.examDate ?? aiFields.examDate,
       examTime: ruleFields.examTime ?? aiFields.examTime,
       examSubjects: ruleFields.examSubjects?.length > 0 ? ruleFields.examSubjects : aiFields.examSubjects,
       examType: ruleFields.examType !== '其他' ? ruleFields.examType : aiFields.examType,
       registrationDeadline: ruleFields.registrationDeadline ?? aiFields.registrationDeadline,
       examLocation: ruleFields.examLocation ?? aiFields.examLocation,
       salaryRange: ruleFields.salaryRange ?? aiFields.salaryRange,
     };
     ```
2. 置信度审计：`aiFields.confidence < 0.5` → `console.warn` + 记录到 `output/low-confidence.log`
3. 保留 AI 调用失败时的规则兜底（已有 catch 逻辑）
4. 统计输出保持 `{aiCalls, aiSuccess, ruleFallback, rulePrimary}` 扩展

**验收**：
- [ ] 合并逻辑：规则值优先于 AI 值（代码可查）
- [ ] `examDate` 来自规则提取器的值不会被 AI 覆盖
- [ ] confidence < 0.5 有日志记录
- [ ] 运行 `node process.js`（单站）不报错

---

## P0-03：`generate-import-sql.js` 修复

**目标**：raw_html 入库 + 真实 crawled_at。

**改动文件**：`crawlers/generate-import-sql.js`

**要求**：
1. `raw_html` 从 `'NULL'` 改为实际导入：
   ```javascript
   // 受限源（compliance_level=restricted）存 snippet，普通源存完整（截断 100KB）
   item.complianceLevel === 'restricted'
     ? escapeSql((item.rawHtml || '').slice(0, 2000))
     : escapeSql((item.rawHtml || '').slice(0, 100000))
   ```
2. `crawled_at` 不再用 `new Date().toISOString()` 统一时间——用 `item.crawledAt`（如存在），否则才兜底当前时间
3. 保持 `INSERT OR IGNORE` 幂等 + `url_hash` 去重

**验收**：
- [ ] 生成的 SQL 中 `raw_html` 列非全 NULL（抽样检查）
- [ ] 有 `compliance_level` 列映射（无该字段时默认 'safe'）
- [ ] crawled_at 使用真实爬取时间（有 crawledAt 时）

---

## P0-04：前端假数据清理

**目标**：统计/科目/考试类型不再显示假数据。

**改动文件**：`frontend/lib/api.ts`、`frontend/components/HomeClient.tsx`、`frontend/components/Stats.tsx`（按需）、`frontend/lib/mock-data.ts`（仅 dev 保留）

**要求**：
1. `fetchStats().catch(() => MOCK_STATS)` → 改为失败设置 error state（HomeClient 已有 listError 模式，stats 增加对应处理）
2. Stats 卡片：`weeklyNew`/`upcomingExams`/`totalChange` 后端不返回 → 后端补真实字段（P0-01 协同，或前端移除这三个卡片只显示 API 真实返回的 total/byRegion/byExamType）
3. 科目筛选项：`fetchSubjects()` 从 `MOCK_SUBJECTS` 改为真实数据——新增后端 `GET /api/subjects`（从 announcements 的 exam_subjects 派生去重），前端调用它；后端未实现前保留 mock 但标注 TODO
4. 考试类型：`fetchExamTypes` catch 后返回 `MOCK_EXAM_TYPES` → 失败返回 `[]` + error state
5. 生产路径（NODE_ENV !== development）禁止 import mock-data

**验收**：
- [ ] `grep -rn "MOCK_" frontend/app frontend/components` 无生产引用（lib/api.ts 的 dev fallback 除外）
- [ ] stats 失败显示错误态而非假数据
- [ ] 科目筛选有结果时来自真实数据

---

## P0-05：安全加固

**目标**：堵住 API 安全隐患。

**改动文件**：`api/src/index.js`（或拆分后的对应文件）

**要求**：
1. `/api/ai/extract`、`/api/ai/classify` 加 Bearer token 鉴权：
   ```javascript
   const auth = request.headers.get('Authorization') || '';
   if (auth !== `Bearer ${env.AI_API_TOKEN}`) return jsonResponse({ error: 'Unauthorized' }, 401);
   ```
2. `pageSize` 上限 100（`parsePagination` 工具）
3. `examCategory` LIKE 转义：`%`/`_` → `\%`/`\_` + `ESCAPE '\'`
4. CORS：生产环境仅允许 `https://kaojing-monitor.pages.dev`（`ALLOWED_ORIGINS` 配置），本地开发允许 localhost
5. feedback 字段校验：type 枚举、content 长度 ≤ 2000

**验收**：
- [ ] 无 token 调 AI 端点返回 401
- [ ] `pageSize=100000` 被截断到 100
- [ ] LIKE 查询带 ESCAPE
- [ ] CORS 头在非白名单 origin 下不带 `Access-Control-Allow-Origin`

---

## P0-06：后端路由拆分

**目标**：540 行单文件拆为规范结构（routes/services/lib/config）。

**改动文件**：`api/src/` 全部

**要求**：按 `BACKEND_STANDARD.md §1` 结构拆分，**拆分后行为必须与现状一致**：
- `index.js`：路由注册 + CORS + 错误兜底（保留 scheduled()）
- `routes/`：6 个端点的 handler
- `services/extract-service.js`：提取编排（如已由 P0-01 建）
- `lib/`：db/response/validate/ai-text
- `config.js`：模型名、白名单、ALLOWED_ORIGINS、默认值

**验收**：
- [ ] 拆分后 `wrangler dev` 启动无错
- [ ] 6 端点 curl 测试通过且响应与原实现一致
- [ ] 无重复代码（每函数只定义一次）

---

## 执行顺序与依赖

```
P0-06（拆分，独立） ──→ P0-01（extract 重构，依赖拆分）
P0-02（process.js，独立于后端）
P0-03（import-sql，独立）
P0-05（安全，可与 P0-01 并行，同文件域需协调）
P0-04（前端，独立）
```

**并发分组建议**：
- Agent A（后端）：P0-06 → P0-01 → P0-05（同文件域串行）
- Agent B（爬虫）：P0-02 + P0-03
- Agent C（前端）：P0-04

---

## 统一约束（所有任务）

1. 遵循对应开发规范（后端/前端/数据库）——**必读后再动手**
2. 不修改与任务无关的文件
3. 不动线上数据库、不执行部署命令
4. 完成后报告：改动文件清单 + 验收项自查结果 + 遗留风险
5. 代码提交前自查：无调试残留、无 any、无吞错
