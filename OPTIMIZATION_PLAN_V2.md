# 考情监测系统 · 深度诊断与优化方案

**版本**：v2.0
**日期**：2026-08-19
**状态**：待评审
**诊断基准**：全链路代码审阅 + 线上 API 实测 + 业界方案调研（三轮交叉验证）

---

## 第一部分：深度诊断

### 1.1 诊断结论摘要

| 层级 | 状态 | 核心问题 |
|---|---|---|
| 数据管道 | 🔴 断裂 | AI 提取恒真短路 + 幻觉套模板 + raw_html 不落库 |
| 自动化链路 | 🔴 断头 | 定时爬取产物永不进库，"定时监测"名存实亡 |
| 展示层 | 🔴 失真 | 统计/筛选/类型选项在显示假数据 |
| 后端 API | 🟡 可用但有隐患 | 无鉴权无限流、LIKE 未转义、pageSize 无上限 |
| 工程治理 | 🟡 混乱 | 死代码、文档三方矛盾、工作区大量未提交 |

### 1.2 数据管道诊断（P0）

**证据链**（代码级）：

```
process.js extractAnnouncements()
  ├─ callWorkerAI('extract') → 返回 {recruitCount, examSubjects, confidence}
  ├─ hasValidData 判断（第 162-165 行）:
  │    recruitCount != null || examSubjects.length > 0 || examDate != null
  │    → AI 几乎总返回 recruitCount + 科目 → 恒为 true
  ├─ usedAI = true → 规则兜底 ruleExtractFields() 永不执行
  └─ finalFields = {recruitCount, examSubjects}（不含日期字段）
      → 写入 D1 时 exam_date / registration_deadline / exam_type 全 NULL
```

**线上实测证据**（2026-08-19 13:30）：

```
GET /api/stats → byExamType: [{exam_type: null, count: 139}]  ← 139 条考试类型全 null
GET /api/announcements → 抽样:
  recruitCount: 27 ✅  examDate: null  examType: null
  registrationDeadline: null  examLocation: null  salaryRange: null
本地 processed-data.json（139 条）:
  examDate 0/139  registrationDeadline 0/139  examType 0/139
  examLocation 0/139  salaryRange 0/139
  recruitCount 131/139  examSubjects 136/139
```

**数据可信度危机**（比字段缺失更严重）：

```
139 条公告的 examSubjects 几乎全为:
  ["综合应用能力A类", "职业能力倾向测验"]
连"江苏省三支一扶招募公告"都是这两个科目 → 明显是 AI 幻觉套模板
→ recruitCount（131/139 有值）可信度同样存疑
```

**根因**：
1. `api/src/index.js` 的 `/api/ai/extract` 提示词只要求输出 `{recruitCount, examSubjects, confidence}`（第 490-506 行）——日期/类型/地点字段根本不在输出设计内
2. 模型 `llama-3.2-3b-instruct` **不在 Cloudflare Workers AI JSON Mode 支持列表**（官方文档核实），只能靠纯提示词碰运气
3. `confidence` 字段被提取但从未被使用——没有置信度阈值，没有低置信兜底

### 1.3 自动化链路诊断（P0）

| 环节 | 现状 | 证据 |
|---|---|---|
| Workers Cron | 只写一条 `triggered` 日志，TODO 未实现 | `api/src/index.js` 第 56-80 行 `scheduled()` |
| GitHub Actions | 定时爬取 ✅，但"Upload to D1"是 placeholder | `.github/workflows/crawler.yml` 最后一步 |
| 数据入库 | 全靠手动三连：跑爬虫 → 生成 SQL → wrangler import | 线上 139 条均来自手动导入 |

**结论**：产品核心卖点"自动化监测"未实现。每天 2:07 和 14:23 定时任务空转，数据永远不会自动更新。

### 1.4 展示层诊断（P1）

| 位置 | 问题 | 证据 | 后果 |
|---|---|---|---|
| Stats 卡片 | 渲染 `weeklyNew/upcomingExams`，但 `/api/stats` 不返回 | `Stats.tsx` 第 27/35 行 vs `index.js` getStats() | 线上恒显 0 或 MOCK(68/23) |
| 科目筛选 | 选项硬编码 mock（职测/公基/综合） | `mock-data.ts` 第 137-143 行 | 与真实数据"综合应用能力A类"零匹配 → 筛选必空 |
| 考试类型 | `fetchExamTypes` catch 后返回 `MOCK_EXAM_TYPES` | `api.ts` 第 337-349 行 | 假选项，筛选无效 |
| 错误处理 | `fetchStats().catch(() => MOCK_STATS)` 静默吞错 | `HomeClient.tsx` 第 44 行 | 后端故障无感知，显示假数据 |

### 1.5 后端 API 诊断（P2）

| 问题 | 位置 | 风险 |
|---|---|---|
| `/api/ai/extract`、`/api/ai/classify` 公开无鉴权无限流 | `index.js` 第 38-44 行 | 任何人可刷爆 10,000 neurons/天免费额度 |
| CORS 全开 `*` | `index.js` 第 326 行 | 任意站点可调用 |
| `pageSize` 无上限 | `index.js` 第 98 行 | 传 100000 拖垮 D1 |
| `examCategory` LIKE 未转义 `%`/`_` | `index.js` 第 117 行 | SQL 通配符注入 |
| `source_website_id` 恒 NULL | `generate-import-sql.js` | 外键断裂，crawl_logs 关联是摆设 |
| `raw_html` 导入时显式置 NULL | `generate-import-sql.js` 第 76-77 行 | 线上无原始正文，无法离线重提取 |

### 1.6 工程治理诊断（P2）

- **死代码**：`ai-filter.js` 未被引用、`hybrid-filter/extractor` 注释残留、`extractor.js.backup` 在仓库
- **文档三方矛盾**：README 写 1424 条 / DEPLOYMENT_SUCCESS 写 984 条 / CLAUDE.md 写 139 条
- **`FINAL_DELIVERY.md` 声称"爬虫 100% 完成"**，但 `scheduled()` 是空的
- **数据覆盖缩水**：山东 1006 → 117（maxPages=3 + 6 个月日期过滤）
- **工作区大量未提交**：`processed-data.json`(139条成果)、CLAUDE.md、validator.js、30+ SQL 文件

---

## 第二部分：优化方案

### 2.0 方案依据（业界调研结论）

针对"文档分类 + 信息抽取"任务，业界可靠方案（三轮调研交叉验证）：

1. **结构化输出铁律**：AI 输出被代码消费时必须用约束，不用纯提示词
   - 可靠性谱系：纯提示词(L1) < JSON mode(L2) < Function calling(L3) < 约束解码(L4)
2. **Cloudflare Workers AI 支持 JSON Mode**（官方文档）：`response_format: {type:"json_schema", json_schema:{...}}`
   - 支持模型：llama-3.1-8b-instruct(-fast)、llama-3.3-70b-fp8-fast、deepseek-r1-distill-qwen-32b 等
   - ⚠️ 当前用的 `llama-3.2-3b-instruct` 不在支持列表
   - ⚠️ `qwen3-30b-a3b-fp8` 也**不在官方 JSON Mode 列表**（需实测兼容性，见 2.1）
3. **分层解耦架构**（简历解析同构）：理解(分类) → 抽取(LLM+schema) → 归一化(规则) → 校验(置信度/missing)
4. **分类任务**：规则前置是业界认可做法（本项目纯规则过滤方向正确，保留）

### 2.1 模型选型与成本核算（已核实）

**qwen3-30b-a3b-fp8 会不会超额？→ 不会。**

Cloudflare Workers AI 官方定价（2026-08-19 核实）：

| 模型 | 输入 $/M | 输出 $/M | neurons/M in | neurons/M out | 单次调用(8K入/200出) | 139条全量 | 每日50条 |
|---|---|---|---|---|---|---|---|
| llama-3.2-3b（当前） | 0.051 | 0.335 | 4625 | 30475 | 43.1 | 5990 | 2155 ✅ |
| **qwen3-30b-a3b-fp8（目标）** | **0.051** | **0.335** | **4625** | **30475** | **43.1** | **5990** | **2155 ✅** |
| llama-3.1-8b-fp8-fast（备选） | 0.045 | 0.384 | 4119 | 34868 | 39.9 | 5550 | 1996 ✅ |
| llama-3.1-8b（原始） | 0.282 | 0.827 | 25608 | 75147 | 219.9 | 30565 | 10995 ⚠️ |
| gemma-3-12b-it | 0.345 | 0.556 | 31371 | 50560 | 261.1 | 36290 | 13054 ⚠️ |

**关键结论**：
- `qwen3-30b-a3b-fp8` 是 MoE 架构（总 30B 仅激活 3B）+ FP8 量化，**定价与 llama-3.2-3b 完全相同**
- 免费额度 10,000 neurons/天：139 条全量重提 ≈ 6000 neurons，每日新增 50 条 ≈ 2155 neurons，**全程免费**
- **风险**：qwen3-30b-a3b-fp8 不在官方 JSON Mode 支持列表。落地时**必须先实测** `response_format` 兼容性
- **容错设计**：若 qwen3 的 JSON Mode 实测不支持 → 回退 `llama-3.1-8b-instruct-fp8-fast`（官方确认支持 JSON Mode，成本几乎相同 39.9 neurons）

### 2.2 实施路线（4 阶段）

---

#### 阶段 1：止血 —— 提取链路重构（最高优先级）

**目标**：消灭幻觉 + 让日期/类型字段有值 + 原始数据落库

**1.1 API 端 `/api/ai/extract` 重构**（`api/src/index.js`）

```javascript
// 改造前：纯提示词，模型 llama-3.2-3b，只输出 2 字段
// 改造后：JSON Mode + schema 全覆盖 + 模型可配

const EXTRACT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'; // 目标，实测不兼容则回退 llama-3.1-8b-instruct-fp8-fast

const response = await env.AI.run(EXTRACT_MODEL, {
  messages: [
    { role: 'system', content: '你是招考公告信息提取专家。按 schema 提取，无把握的字段返回 null，禁止编造。' },
    { role: 'user', content: `标题：${title}\n正文HTML：${truncatedHtml}` }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      type: 'object',
      properties: {
        recruitCount: { type: ['integer', 'null'], description: '招聘总人数' },
        examDate: { type: ['string', 'null'], description: '笔试日期 YYYY-MM-DD' },
        examTime: { type: ['string', 'null'], description: '考试时间 HH:MM-HH:MM' },
        examSubjects: { type: 'array', items: { type: 'string' }, description: '考试科目，找不到返回空数组' },
        examType: { type: ['string', 'null'], description: '事业单位/公务员/教师招聘/三支一扶/医疗卫生/国企招聘/其他' },
        examLocation: { type: ['string', 'null'], description: '考试地点' },
        registrationDeadline: { type: ['string', 'null'], description: '报名截止日期 YYYY-MM-DD' },
        salaryRange: { type: ['string', 'null'], description: '薪资范围' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        missingFields: { type: 'array', items: { type: 'string' }, description: '无法提取的字段名列表' },
        warnings: { type: 'array', items: { type: 'string' } }
      },
      required: ['recruitCount', 'examDate', 'examSubjects', 'confidence']
    }
  }
});
```

**1.2 爬虫端 `process.js` 提取逻辑重构**（分层解耦）

```javascript
// 改造前：AI 恒真短路，规则永不执行
// 改造后：规则优先 + AI 补充 + 置信度兜底

async function extractAnnouncement(item) {
  // 第一层：规则提取（快、稳、可解释）—— 已验证日期 52%、人数 94%
  const ruleFields = ruleExtractFields(item);

  // 第二层：AI 补充缺失字段（JSON Mode + schema）
  const aiFields = await callWorkerAI('extract', { title: item.title, rawHtml: item.rawHtml || '' });

  // 第三层：合并（规则优先，AI 只补缺失）
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

  // 第四层：置信度审计
  if (aiFields.confidence < 0.5) {
    console.warn(`⚠ 低置信度提取: ${item.title} (${aiFields.confidence})`);
    // 记入 low-confidence.log，供人工抽查
  }
  return finalFields;
}
```

**1.3 `generate-import-sql.js` 修复**：`raw_html` 必须入库

```javascript
// 改造前：'NULL' // raw_html 太大，暂不导入
// 改造后：escapeSql(item.rawHtml?.slice(0, 100000) || '')  // 限制长度但保留正文
```

**1.4 数据重提取流程**（修复后执行）

```
本地 processed-data.json（含 rawHtml，139 条）
  → 新 extractAnnouncement() 重新提取
  → 生成新 SQL（含 raw_html）
  → 清空线上 announcements 表（TRUNCATE）
  → 重新导入
  → 验证：examDate 非空率 > 30%（原 0%）
```

**验收标准**：
- [ ] 线上 `byExamType` 不再全 null（至少 >50% 有值）
- [ ] `examDate` 非空率 > 30%（规则层已实测可达 9-52%，合并后应更高）
- [ ] `examSubjects` 不再模板化（抽样 10 条人工核对）
- [ ] 线上 DB `raw_html` 非空

---

#### 阶段 2：接上自动化断头

**目标**：定时爬取的数据自动进库

**2.1 `crawler.yml` 补"Upload to D1"步骤**

```yaml
- name: Upload to D1
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: |
    cd crawlers
    node generate-import-sql.js
    npx wrangler d1 execute kaojing-db --remote --file=./output/import-data.sql
```

**2.2 前置条件**：在 GitHub Secrets 配置 `CLOUDFLARE_API_TOKEN`（权限：Workers Scripts + D1）+ `CLOUDFLARE_ACCOUNT_ID`

**2.3 Workers `scheduled()` 补触发逻辑**（方案二选一）：
- 方案 A：Cron 内调用 GitHub Actions `workflow_dispatch` API（需 PAT，写回本仓库，简单）
- 方案 B：Cron 调自己的 `/api/crawl-trigger` 内部端点（需鉴权，避免公开）

**验收标准**：
- [ ] 手动触发 workflow 后，D1 出现新数据
- [ ] 定时触发（每天 2:07/14:23）后数据自动更新
- [ ] `crawl_logs` 有 `success/failed` 记录（非仅 `triggered`）

---

#### 阶段 3：清理假数据

**目标**：前端展示真实数据

**3.1 Stats 卡片**：
- 后端 `getStats()` 补 `weeklyNew`（7 天内 publish_date）、`upcomingExams`（exam_date 在未来 30 天）
- 或前端移除这两个卡片，只展示 API 真实返回的字段
- 移除 `MOCK_STATS` 兜底：`fetchStats().catch(() => MOCK_STATS)` → 失败时显示错误态

**3.2 科目筛选项**：从真实数据派生
- 新增后端端点 `GET /api/subjects`：`SELECT DISTINCT exam_subjects FROM announcements` 拆分后去重
- 前端 `fetchSubjects()` 改调此端点，删除 `MOCK_SUBJECTS` 硬编码

**3.3 考试类型**：`fetchExamTypes` 已从 stats 派生 ✅（保持），但 `MOCK_EXAM_TYPES` 兜底改为错误态

**验收标准**：
- [ ] 统计卡片数字与真实数据一致
- [ ] 科目筛选点选后有结果（与线上数据匹配）
- [ ] 后端故障时显示错误提示而非假数据

---

#### 阶段 4：安全与工程治理

**4.1 安全**：
- `/api/ai/extract`、`/api/ai/classify` 加 Bearer Token 鉴权（`env.AI_API_TOKEN`），爬虫调用时带 header
- `pageSize` 上限 `Math.min(parseInt(...) || 20, 100)`
- `examCategory` LIKE 转义：`%`→`\%`，`_`→`\_`（配 `ESCAPE '\'`）
- CORS 收窄：生产环境只允许 `https://kaojing-monitor.pages.dev`

**4.2 工程治理**：
- 删除死代码：`ai-filter.js`、`hybrid-filter.js`、`hybrid-extractor.js`、`extractor.js.backup`
- 统一 `crawlers/` 与 `api/src/` 爬虫逻辑（或明确职责边界）
- 提交工作区所有未提交改动（139 条数据成果、CLAUDE.md、validator.js、SQL 文件）
- 统一文档数据口径：以 CLAUDE.md 为准，修正 README/DEPLOYMENT_SUCCESS/FINAL_DELIVERY
- 数据质量报告：`crawlers/output/quality-report.json` 记录每次重提的字段完整率

**验收标准**：
- [ ] AI 端点无 token 返回 401
- [ ] `pageSize=100000` 返回 400 或截断
- [ ] `git status` 干净
- [ ] 文档数据口径一致

---

### 2.3 成本汇总（保持 $0/月）

| 项目 | 成本 |
|---|---|
| Workers AI（qwen3-30b-a3b-fp8） | $0（免费额度内：全量重提 6K + 每日 2K neurons） |
| Workers / D1 / Pages | $0（免费额度） |
| GitHub Actions | $0（2000 分钟/月） |
| **合计** | **$0/月** |

### 2.4 执行顺序建议

| 顺序 | 任务 | 依赖 | 预计 |
|---|---|---|---|
| 1 | 模型 JSON Mode 兼容性实测（qwen3 vs llama-3.1-8b-fp8-fast） | 无 | 0.5h |
| 2 | API `/api/ai/extract` 重构（JSON Mode + schema） | 1 | 1h |
| 3 | `process.js` 提取逻辑重构（分层解耦） | 2 | 1h |
| 4 | `generate-import-sql.js` raw_html 入库 | 无 | 0.2h |
| 5 | 离线重提取 139 条 + 导入 D1 + 验证 | 2,3,4 | 1h |
| 6 | crawler.yml 补 Upload D1 + secrets 配置 | 5 | 0.5h |
| 7 | 前端假数据清理（stats/科目/类型） | 5 | 1.5h |
| 8 | 安全加固 + 死代码清理 + git 提交 + 文档统一 | 全部 | 1h |

**总工时**：约 7h（不含用户侧 secrets 配置等待）

---

## 附录 A：风险与回退

| 风险 | 概率 | 缓解 |
|---|---|---|
| qwen3-30b-a3b-fp8 JSON Mode 不兼容 | 中 | 实测先行；回退 llama-3.1-8b-fp8-fast（成本几乎相同，官方确认支持） |
| 升级模型后输出质量仍差 | 低 | 分层方案规则层兜底 52% 日期；低置信度记日志人工抽查 |
| D1 重导入影响线上 | 中 | 凌晨执行；TRUNCATE + INSERT 原子化；先备份旧表 |
| secrets 配置权限不足 | 中 | 用户侧操作；提供详细指引 |

## 附录 B：本次诊断的完整证据清单

- `api/src/index.js` 第 42-44 行（AI 端点）、第 56-80 行（scheduled 空转）、第 482-511 行（extract 提示词只提 2 字段）
- `crawlers/process.js` 第 140-192 行（hasValidData 恒真短路）
- `crawlers/generate-import-sql.js` 第 76-77 行（raw_html 置 NULL）
- `frontend/lib/api.ts` 第 337-357 行（fetchSubjects 返回 MOCK）
- `frontend/components/HomeClient.tsx` 第 44 行（fetchStats 吞错）
- 线上实测：`/api/stats` byExamType 全 null；`/api/announcements` 抽样字段
- Cloudflare 官方文档：Workers AI JSON Mode 支持列表、定价表（2026-08-19 抓取）
