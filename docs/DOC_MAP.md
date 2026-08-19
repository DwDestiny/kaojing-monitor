# 考情监测 · 文档地图（GEB DOC MAP）

> **GEB 原则**：文档是团队的共享记忆。每个主题一份权威文档，其他文档只引用不复制。开发前先查地图定位权威来源，禁止凭记忆或猜测写代码。
> **维护**：新增/修改文档必须在此登记。本文件是项目文档的唯一索引。

**最后更新**：2026-08-19 15:00

---

## 📍 权威文档（Ground Truth，开发前必读）

| 文档 | 主题 | 何时读 | 状态 |
|---|---|---|---|
| `CLAUDE.md` | 项目总览 + 技术栈 + 状态 + 变更记录 | 每次接手会话必读 | ✅ 2026-08-19 更新 |
| `docs/MASTER_UPGRADE_PLAN.md` | **总升级计划**（数据源/合规/数据结构/路线） | 规划开发顺序时读 | ✅ 2026-08-19 |
| `docs/REQUIREMENTS_V2.md` | v2 需求规划（辅导员表分析 + 产品设计） | 做功能需求时读 | ✅ 2026-08-19 |
| `OPTIMIZATION_PLAN_V2.md` | 系统缺陷诊断 + 信息提取方案（P0） | 修复缺陷时读 | ✅ 2026-08-19 |
| `docs/standards/BACKEND_STANDARD.md` | **后端开发规范（强制）** | 写 `api/` 代码前必读 | ✅ 2026-08-19 |
| `docs/standards/FRONTEND_STANDARD.md` | **前端开发规范（强制）** | 写 `frontend/` 代码前必读 | ✅ 2026-08-19 |
| `docs/standards/DATABASE_STANDARD.md` | **数据库规范（强制）** | 写 schema/导入 SQL 前必读 | ✅ 2026-08-19 |
| `database/schema-d1.sql` | D1 表结构唯一权威（全量建表） | 涉及 DB 结构时读 | ⚠️ 待迁移扩展 |
| `database/migrations/` | 增量迁移（新增） | 改已有表结构时读 | 📌 待创建 |

---

## 🧭 按任务定位文档

| 你要做的事 | 必读文档（按序） | 可参考 |
|---|---|---|
| 修提取链路（AI 字段提取） | OPTIMIZATION_PLAN_V2 §2.2 → BACKEND_STANDARD §6 → DATABASE_STANDARD §3 | CLAUDE.md §爬虫 |
| 改前端页面/组件 | FRONTEND_STANDARD（全篇）→ REQUIREMENTS_V2 §4 | CLAUDE.md §前端 |
| 加/改数据库表 | DATABASE_STANDARD（全篇）→ schema-d1.sql → MASTER_UPGRADE_PLAN §3.2 | docs/database/schema.md |
| 扩展爬虫数据源 | MASTER_UPGRADE_PLAN §1.2 → crawler-design.md → engine.js | sites.json |
| 做合规/版权相关 | MASTER_UPGRADE_PLAN §2（合规对策）→ DATABASE_STANDARD §4 | — |
| 部署/上线 | CLAUDE.md §部署架构 → wrangler.toml | CLOUDFLARE_PAGES_SETUP.md |
| 需要了解业务背景 | REQUIREMENTS_V2 §1（辅导员表分析）→ 目录导航 | — |

---

## 🗂️ 全量文档登记

### 根目录（5）
| 文档 | 主题 | 状态 |
|---|---|---|
| `CLAUDE.md` | 项目主文档（GEB L1） | ✅ 活跃 |
| `README.md` | 对外说明 | ⚠️ 数据过时（1424 条旧值，待修） |
| `OPTIMIZATION_PLAN_V2.md` | 缺陷诊断 + 提取方案 | ✅ 活跃 |
| `ISSUES.md` | 08-17 问题清单 | ⚠️ 部分已过时（#2 已修） |
| `TODO.md` | 初始任务清单 | ⚠️ 严重过时（08-17 冻结） |

### docs/（16）
| 文档 | 主题 | 状态 |
|---|---|---|
| `MASTER_UPGRADE_PLAN.md` | 总升级计划 | ✅ 活跃 |
| `REQUIREMENTS_V2.md` | v2 需求规划 | ✅ 活跃 |
| `standards/BACKEND_STANDARD.md` | 后端规范 | ✅ 活跃 |
| `standards/FRONTEND_STANDARD.md` | 前端规范 | ✅ 活跃 |
| `standards/DATABASE_STANDARD.md` | 数据库规范 | ✅ 活跃 |
| `tasks/TASKS_P0.md` | P0 任务包拆解 | ✅ 活跃（2026-08-19） |
| `tasks/TASKS_P1-P3.md` | P1-P3 任务包拆解 | ✅ 活跃（2026-08-19） |
| `architecture/system-design.md` | 系统设计 | ✅ 参考 |
| `architecture/tech-stack-research.md` | 技术选型 | ✅ 参考 |
| `architecture/implementation-plan.md` | 实施方案 | ⚠️ 08-17 冻结 |
| `architecture/development-plan.md` | 开发计划 | ⚠️ 08-17 冻结 |
| `database/schema.md` | 数据库设计文档 | ⚠️ 需同步 schema 变更 |
| `crawler/crawler-design.md` | 爬虫设计 | ⚠️ 声称详情页已实现（实际有缺陷） |
| `crawler/website-analysis-report.md` | 网站调研报告 | ✅ 参考 |
| `recruit-websites-list.md` | 网站清单 | ✅ 参考 |
| `PROGRESS.md` / `STATUS.md` | 进度/状态 | ⚠️ 08-17 冻结 |

### 交付报告（根目录，3）
| 文档 | 主题 | 状态 |
|---|---|---|
| `DELIVERY.md` | 交付说明 | ⚠️ 过时 |
| `FINAL_DELIVERY.md` | 声称"爬虫 100% 完成" | ❌ 与实际不符，勿引用 |
| `DEPLOYMENT_SUCCESS.md` | 部署成功报告（984 条） | ⚠️ 数据过时 |

---

## 🚫 文档纪律（GEB 硬性规则）

1. **只信权威文档**：`FINAL_DELIVERY.md`、`TODO.md`、`README.md` 数据过时，**开发时禁止引用**，以 CLAUDE.md + 代码为准
2. **一处事实只存一份**：数据量、字段定义、规范条款不在多文档重复，需引用时指向权威源
3. **改代码必更文档**：schema 变更 → 更新 schema-d1.sql + migrations + docs/database/schema.md + 本地图
4. **新增文档必登记**：任何新文档创建后，必须在本地图登记
5. **子代理交接**：子代理完成任务后，产出物（文档/代码）变更必须在工作日志 + 本地图反映

---

## 🔧 维护记录

- 2026-08-19 15:00：创建文档地图；登记规范三件套、MASTER_UPGRADE_PLAN、REQUIREMENTS_V2；标记过时文档
