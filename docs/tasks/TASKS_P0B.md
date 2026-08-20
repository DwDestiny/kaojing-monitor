# P0 收尾 · 任务包拆解（TDD 版）

> **日期**：2026-08-20
> **来源**：`docs/OPTIMIZATION_PLAN_V3.md`（用户确认版）+ 用户决策（口令登录/裸奔/IP限频/备注框）
> **开发规范**：`docs/standards/` 三件套——**强制必读**
> **流程纪律**：**TDD（红→绿→重构）→ 规范审查 → 部署验收**，每个任务必须有对应测试，杜绝返工

---

## 流程（每个任务必须遵守）

```
① 写测试（先红）→ ② 实现（转绿）→ ③ 重构清理 → ④ 规范自查 → ⑤ 审查（子代理）→ ⑥ 合并
```

## 任务总览

| ID | 任务 | 领域 | 测试文件 | 验收标准 |
|---|---|---|---|---|
| T0 | 测试基础设施 + TDD 规范 | 全栈 | — | node:test/vitest 可跑；规范追加 TDD 章节 |
| T1 | `GET /api/subjects` | 后端 | `api/test/subjects.test.js` | 真实科目派生、去重、排序 |
| T2 | `/api/feedback` 扩展 + IP 限频 | 后端 | `api/test/feedback.test.js` | 备注提交、announcement_id 绑定、60s 限频 |
| T3 | `/api/admin/verify` + 反馈管理 | 后端 | `api/test/admin.test.js` | 口令验证、5 次锁 10 分钟、列表/状态更新 |
| T4 | 前端科目筛选 + 反馈中心 + 纠错框 + admin 页 | 前端 | `frontend/__tests__/*.test.tsx` | 组件可用、提交绑定、口令记忆 |
| T5 | DB 迁移 + ADMIN_PASSWORD env | DB | — | 列已加、env 已配、schema 同步 |
| T6 | 审查 + 部署 + 全链路验收 | 全栈 | — | 规范审查通过、线上实测通过 |

---

## T0：测试基础设施

**目标**：让 `npm test` 可跑，为后续所有任务提供测试能力。

| 端 | 方案 | 说明 |
|---|---|---|
| 后端 | **node:test**（Node 内置，零依赖） | `api/test/*.test.js`，`node --test` 直接跑；fetch handler 用真实 `Request`/`Response`，D1 用 mock 对象注入 |
| 前端 | **vitest**（安装到 frontend） | `frontend/__tests__/*.test.tsx`，`npx vitest run`；组件用 @testing-library/react |

**验收**：
- [ ] `cd api && node --test test/` 通过（有 1 个冒烟测试）
- [ ] `cd frontend && npx vitest run` 通过（有 1 个冒烟测试）
- [ ] 规范文档追加「TDD 章节」：先写测试、红→绿、每个新端点/组件必须有测试

---

## T1：GET /api/subjects（TDD）

**需求**：前端科目筛选下拉的真实数据源。从 D1 `announcements.exam_subjects`（逗号分隔串）派生。

**测试用例**（先写，红）：
1. 正常：多条公告科目 → 返回去重后数组
2. 空库：返回 `[]`
3. 逗号拆分：`"公共基础知识,专业知识"` → 两项
4. 去重：重复科目只出现一次
5. 排序：按拼音/字母序稳定输出
6. 格式：`{ data: [{ name, count }] }`（含科目出现次数）

**实现**：路由 `/api/subjects` → `SELECT exam_subjects FROM announcements WHERE exam_subjects IS NOT NULL AND exam_subjects != ''` → 拆分/去重/计数 → 返回。

**验收**：6 用例全绿；`curl /api/subjects` 线上返回真实科目。

---

## T2：/api/feedback 扩展 + IP 限频（TDD）

**需求**：详情页纠错（备注框）+ 反馈中心共用。用户决策：裸奔、一个备注框、**同 IP 一分钟 1 次**。

**测试用例**（先写，红）：
1. 正常提交 `{type:'data_error', content, announcement_id}` → 201
2. 缺 content → 400
3. type 非法 → 400
4. content > 500 字（详情页纠错）/ >2000 字（反馈中心）→ 400
5. **同 IP 60 秒内重复 → 429**
6. 不同 IP → 放行
7. announcement_id/contact/ip 正确落库

**实现**：
- DB 加列：`announcement_id INTEGER`、`contact TEXT`、`ip TEXT`（T5 做）
- handler 扩展：读 CF-Connecting-IP 或 `x-forwarded-for` 第一段；限频查最近 60s 同 IP 记录
- 详情页纠错 content 上限 500 字，反馈中心 2000 字（前端区分，后端统一 2000 上限 + 前端 maxLength）

**验收**：7 用例全绿；线上 curl 实测 429 生效。

---

## T3：/api/admin/verify + 反馈管理（TDD）

**需求**：反馈后台口令登录（用户决策：口令 `dangwei121105` 存 env，不用 token）。

**测试用例**（先写，红）：
1. `POST /api/admin/verify {password}` 正确 → `{ok:true}`
2. 口令错误 → 401
3. **错误 5 次 → 锁 10 分钟**（第 6 次即使对也 429）
4. `GET /api/admin/feedback` 无 admin 标记 → 401
5. 带标记 → 返回反馈列表（含公告标题/时间/类型/状态）
6. `POST /api/admin/feedback/:id/status` 更新状态 → 生效
7. 反馈 CSV 导出端点（可选）

**实现**：
- env.ADMIN_PASSWORD 配置（T5）
- 错误计数用 D1 表或内存 Map（Worker 全局单例，够用）+ 时间戳
- admin 数据接口校验：请求头 `x-admin-key: <口令哈希>`（前端登录后存 sessionStorage，带哈希而非明文）

**验收**：7 用例全绿；线上口令错误/正确实测。

---

## T4：前端（TDD）

**需求**：科目筛选接通 + 反馈中心（提建议/推荐网站两 Tab）+ 详情页纠错框 + admin 口令页 + about 合并。

**测试用例**（先写，红）：
1. `api.ts fetchSubjects()` 调用 `/api/subjects`，解析 `data[]`
2. Filter.tsx 渲染真实科目选项（非 mock）
3. 详情页纠错框：输入备注 → 提交带 `announcement_id` + type=data_error → 成功提示
4. 反馈中心：两 Tab 切换、提建议提交 feature_request、推荐网站提交 new_website（名称/地址拼装 content）
5. admin 页：未输入口令不显示数据 → 输对口令显示列表 → sessionStorage 记忆（刷新不重输）
6. about 页"提交新网站"跳转反馈中心

**实现**：`frontend/lib/api.ts` 加 `fetchSubjects/submitFeedback/verifyAdmin/fetchAdminFeedback`；新组件 `FeedbackCenter.tsx`、`CorrectionBox.tsx`、`AdminFeedbackPage.tsx`（app/admin/feedback）；改 `Filter.tsx`、`AnnouncementItem/Detail`、`about/page.tsx`。

**验收**：6 用例全绿；`npm run build` 通过；线上页面实测。

---

## T5：DB 迁移 + ADMIN_PASSWORD env

**实现**：
1. `ALTER TABLE user_feedback ADD COLUMN announcement_id INTEGER; ADD COLUMN contact TEXT; ADD COLUMN ip TEXT;`
2. `api/wrangler.toml [vars]` 加 `ADMIN_PASSWORD = "dangwei121105"`（按 V3 方案，用户约定值）
3. `database/schema-d1.sql` 同步三列
4. 迁移文件 `database/migrations/20260820_feedback_ext.sql`

**验收**：D1 线上 `pragma_table_info(user_feedback)` 含新列；wrangler.toml 有 ADMIN_PASSWORD。

---

## T6：审查 + 部署 + 全链路验收 + 提交

**审查**（子代理，按三份规范逐文件）：
- 后端：路由/命名/参数校验/错误处理/禁止吞错/CORS
- 前端：TS strict 零 any/无 @ts-ignore/错误态必显/语义色
- 数据库：命名/is_known 语义/迁移规范

**修复**：审查问题清单 → 逐条修复 → 复审。

**部署验收**：
- `wrangler deploy` → subjects/feedback 限频/admin 口令线上实测
- 前端 `npm run build` → push 触发 Pages → 线上页面实测（筛选/纠错框/反馈中心/admin）

**提交**：全部改动入库 + 文档地图更新 + 工作日志。
