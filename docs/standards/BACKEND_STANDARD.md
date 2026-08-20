# 后端开发规范（Cloudflare Workers API）

**适用范围**：`api/` 目录（Cloudflare Workers 原生 fetch 路由）
**强制约束**：所有子代理开发必须遵循本规范，代码审查按本规范验收

---

## 1. 架构与文件组织

```
api/
├── src/
│   ├── index.js           # Worker 入口：路由注册 + CORS + 错误兜底
│   ├── routes/            # 路由处理器（按资源拆分）
│   │   ├── announcements.js
│   │   ├── stats.js
│   │   ├── regions.js
│   │   ├── feedback.js
│   │   └── ai.js          # AI 端点（classify/extract）
│   ├── services/          # 业务逻辑层（可复用）
│   │   └── extract-service.js   # 字段提取编排（规则+AI+合并+置信度）
│   ├── lib/               # 工具函数
│   │   ├── db.js          # D1 查询封装
│   │   ├── response.js    # jsonResponse / CORS
│   │   ├── validate.js    # 参数校验
│   │   └── ai-text.js     # AI 响应解析（extractAiText/parseAiJson）
│   └── config.js          # 常量：模型名、白名单、默认值
├── wrangler.toml
└── package.json
```

> 现状 `api/src/index.js` 是单文件 ~540 行，需按上表拆分。**拆分时必须保持路由行为不变**，拆分后跑通全部端点再提交。

## 2. 命名规范

| 项 | 规则 | 示例 |
|---|---|---|
| 文件 | kebab-case | `extract-service.js` |
| 函数 | camelCase | `getAnnouncements` |
| 常量 | UPPER_SNAKE_CASE | `EXTRACT_MODEL` |
| 路由路径 | kebab-case | `/api/announcements/:id` |
| 查询参数 | camelCase | `examCategory` |
| DB 列 | snake_case | `exam_subjects` |
| 表名 | 复数 snake_case | `announcements` |

## 3. 路由注册模式（index.js）

```javascript
// 统一模式：路由表 + try/catch 兜底
const routes = [
  { path: '/api/announcements', method: 'GET', handler: getAnnouncements },
  { path: '/api/announcements/:id', method: 'GET', handler: getAnnouncementById },
  // ...
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return handleCORS();
    try {
      const route = routes.find(r => r.method === request.method && matchPath(url.pathname, r.path));
      if (!route) return jsonResponse({ error: 'Not found' }, 404);
      return await route.handler(request, env, ctx, url);
    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};
```

## 4. 参数校验（强制）

```javascript
// lib/validate.js — 每个 handler 入口必须校验
export function parsePagination(url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20));
  return { page, pageSize };
}
```

**规则**：
- `pageSize` 上限 **100**（当前无上限，必须修复）
- 所有查询参数必须显式校验类型/取值范围
- SQL 排序字段走白名单：`{publish_date, id, title}`（已有 ✅）
- `LIKE` 参数必须转义 `%`/`_`：`escapeLike(term)` → `term.replace(/[%_\\]/g, m => '\\' + m)` + `ESCAPE '\\'`

## 5. SQL 规范（D1）

- **全部使用参数绑定**（`prepare().bind()`），禁止字符串拼接
- 禁止 `SELECT *` 用于业务查询（详情页例外：需要 raw_html）
- 分页必带 `LIMIT ? OFFSET ?` + 总数 COUNT 同步
- 排序白名单 + `ORDER BY ${sortBy} ${sortOrder}, id DESC`
- 查询结果 snake_case → camelCase 映射统一在 `lib/db.js` 的 `mapRow()` 完成

## 6. AI 端点规范（关键）

```javascript
// config.js
export const EXTRACT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
export const EXTRACT_MODEL_FALLBACK = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
export const CLASSIFY_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';

// services/extract-service.js — 提取编排
export async function extractAnnouncement(item, env) {
  const ruleFields = ruleExtractFields(item);          // 1. 规则优先
  const aiFields = await callExtractAI(item, env);     // 2. AI 补缺（JSON Mode）
  return mergeFields(ruleFields, aiFields);            // 3. 合并（规则优先）
  // 4. 置信度审计：aiFields.confidence < 0.5 → 记日志
}
```

**AI 调用硬性要求**：
- 必须使用 `response_format: { type: 'json_schema', json_schema: {...} }`（JSON Mode）
- schema 必须覆盖全部提取字段 + `confidence` + `missingFields` + `warnings`
- 模型名放 `config.js`，不硬编码在 handler 里
- 响应解析失败 → 返回结构化错误 `{ error, raw }`，由调用方降级（不用规则兜底时也要 catch）
- AI 端点鉴权：`Authorization: Bearer <env.AI_API_TOKEN>`，无 token 返回 401

## 7. 错误处理

- 业务错误：`jsonResponse({ error: 'msg' }, 4xx)`，消息具体可读
- 未捕获异常：入口 catch → 500 + `console.error` 记录（**不返回堆栈**）
- 所有 `await env.DB...` 可能失败的调用需 catch（D1 抖动）
- 禁止吞错：`catch {}` 空块不允许，必须至少 `console.warn`

## 8. 安全基线

- CORS：生产环境仅允许 `https://kaojing-monitor.pages.dev`（`config.js` 配置 `ALLOWED_ORIGINS`）
- AI 端点必须鉴权（Bearer token）
- feedback 端点：字段类型校验 + 长度上限（content ≤ 2000 字）
- 不返回任何内部信息（env 结构、堆栈、DB 错误原文）

## 9. 提交/验收清单

- [ ] `npm run dev`（wrangler dev）本地全端点通过
- [ ] 参数校验：`pageSize=100000` 被截断、非法参数返回 4xx
- [ ] AI 端点无 token 返回 401
- [ ] 路由拆分后行为与原单文件一致（curl 对比 6 个端点）
- [ ] 无 `console.log` 残留调试代码（允许 `console.error/warn`）

## §TDD 章节（2026-08-20 追加）

**强制**：任何新增/修改端点，必须先写测试（红）→ 实现（绿）→ 重构。

- 测试框架：Node 内置 `node:test`（零依赖），文件放 `api/test/*.test.js`
- 运行：`cd api && npm test`（=`node --test test/*.test.js`）
- 用例覆盖：正常路径 / 参数校验失败(400) / 鉴权失败(401) / 限频(429) / 边界值
- fetch handler 测试：用真实 `Request`/`Response` 构造，D1 用 mock 对象注入（`{ prepare: () => ({ bind: () => ({ run: async () => ({meta:{changes:1}}), all: async () => ({results:[]}) }) }) }`）
- 禁止：无测试的端点合入；测试写假断言（必须断言真实行为）
