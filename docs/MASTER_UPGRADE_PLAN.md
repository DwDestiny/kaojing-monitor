# 考情监测系统 · 总升级计划（MASTER PLAN）

**版本**：v1.0
**日期**：2026-08-19
**上游依据**：
- `OPTIMIZATION_PLAN_V2.md`（系统缺陷诊断 + 信息提取方案）
- `docs/REQUIREMENTS_V2.md`（辅导员 Excel 需求规划）
- 辅导员表数据源全量提取（42 sheet / 8370 域名）
- 来源网站合规调研（2026-08-19）

---

## 第一部分：数据源扩展计划

### 1.1 全库来源扫描结论（基于辅导员表实测）

| 统计项 | 数值 |
|---|---|
| 命中链接总次数 | 66,361 |
| 去重域名总数 | 8,370 |
| 其中 gov.cn 官方站 | 4,280 |
| 非政府域名 | 4,089 |
| 高频域名（≥5次） | 2,389 |
| 公众号（mp.weixin.qq.com） | 10,842 次，21 表，**第一来源** |

### 1.2 数据源分级（按爬取价值与合规风险）

| 优先级 | 来源类型 | 代表域名 | 爬取策略 |
|---|---|---|---|
| **S 级（核心，优先接入）** | 省人社厅官网 | mohrss.gov.cn、rsj.beijing.gov.cn、rsj.sh.gov.cn、rlsbj.cq.gov.cn、hrss.shandong.gov.cn、jshrss.jiangsu.gov.cn、hrss.gd.gov.cn、rlsbt.zj.gov.cn、rst.guizhou/hunan/hebei/hubei.gov.cn 等 | 结构化列表页 + 详情页爬取（现有引擎扩展配置即可） |
| **S 级** | 人事考试院/中心 | scpta.com.cn（四川）、gxpta.com.cn（广西）、lnrsks.com（辽宁）、qhpta.com（青海）、gkzp.renshenet.org.cn（中国人事考试网）、zgrsks.com.cn | 同上，多数为 JSON/静态分页，易结构化 |
| **A 级（重点扩展）** | 综合招考平台 | qgsydw.com（全国事业单位招聘网，179次）、sydw.gxrc.com（广西人才）、hxrc.com（海峡人才）、nbrc.com.cn（宁波）、cxhr.com、ncrczpw.com、xjrc365.com | 结构化程度高，一次接入覆盖多地 |
| **A 级** | 国央企招聘 | zhaopin.cnpc.com.cn（中石油）、zhaopin.sgcc.com.cn（国网）、tobacco.gov.cn（烟草）、et.airchina.com.cn（国航）、career.cmbchina.com（招行） | 各司独立招聘系统，需要逐一配置，价值高（辅导员重点咨询对象） |
| **B 级（谨慎接入）** | 军队文职 | **81rc.81.cn（军队人才网）** | ⚠️ **见合规部分，只做索引不存正文** |
| **C 级（暂不爬取）** | 公众号 | mp.weixin.qq.com（10,842 次） | 反爬强、正文在 JS 中、版权风险高；仅人工收录 |
| **D 级（不爬取）** | 培训机构 | fenbi.com、offcn.com、huatu.com | 商业内容版权风险，只做外链 |
| **D 级** | 报名 SaaS | pzhl.net、nuoyoukao.com、kaowu.cn | 非公告源，是报名入口，无爬取价值 |
| **D 级** | IP 直连 | 202.61.89.231 等 30+ 个 | 稳定性差，不接入 |

### 1.3 扩展后的目标数据源规模

```
现状：8 个源（山东/江苏/福建/天津/新疆/北京/广东 + 北京机关）
目标：S级 20 + A级 10 ≈ 30 个源
覆盖：31 省人社厅（省级全覆盖）+ 5 大综合平台 + 10 大国央企
```

---

## 第二部分：合规要求与对策（重点）

### 2.1 合规调研结论（2026-08-19）

| 来源 | 合规状态 | 原文依据 |
|---|---|---|
| **军队人才网（81rc.81.cn）** | 🔴 **严格限制** | 官方声明："未对任何单位（包括教育培训机构）、组织及个人授权或与其合作出版、发行、销售军队文职人员招聘考试相关辅导材料"；"军队人才网为本次公开招考信息发布、网上报名等**唯一指定网站**" |
| 重庆人社厅 | 🟡 标注来源 | 版权声明："任何媒体、互联网站和商业机构不得利用本网站发布的内容进行**商业性的原版原式转载**"；"引用或转载本网站内容必须明确标注'来源：重庆市人力资源和社会保障局官方网站'" |
| 政府信息公开 | 🟢 合规 | 《政府信息公开条例》：招考公告属"应主动公开的政府信息"（沙洋县人社局公开指南明确含"事业单位招考的职位、名额、报考条件"） |
| 著作权法 | 🟢 事实信息不受保护 | 《著作权法》第5条：**单纯事实消息不受著作权法保护**——招考的时间、人数、条件等事实性字段可自由使用；但**全文复制正文有风险** |

### 2.2 合规对策（写入产品设计）

**核心原则：只提事实字段 + 外链跳转，不存全文正文。**

| 来源级别 | 采集内容 | 存储策略 | 展示策略 |
|---|---|---|---|
| 政府源（S/A） | 标题、时间节点、人数、科目、地区等**事实字段** | 结构化字段入库，raw_html 仅保留**前 N KB 供提取**（不对外展示） | 展示结构化字段 + **"查看原文"外链**跳转官网；标注"来源：XX人社厅 + 采集时间" |
| 综合平台（A） | 同上 | 同上 | 同上 + 标注来源平台 |
| 国央企（A） | 同上 | 同上 | 同上 |
| **军队文职（B）** | **仅标题 + 公告 URL + 关键时间（公告/报名/笔试）** | **不存 raw_html** | 仅展示标题 + 时间 + 外链；页脚明示"信息来源：军队人才网，以官网为准" |
| 公众号（C） | 不爬取 | — | 人工收录标题 + 原文链接 |
| 培训/第三方（D） | 不爬取 | — | — |

**统一合规要素（所有记录）**：
- `source` 字段完整标注来源网站全名
- 列表/详情页展示"来源 + 采集时间"
- 详情页强外链"查看原文"（政府官网）
- 免责声明：页面底部"所有公告信息以官方发布为准，本平台仅作信息聚合"
- 爬虫侧：已遵守 robots.txt、UA 标识（KaoQingBot/1.0）、请求间隔 1-3s、频率 1-2 次/天（现有实现已具备 ✅）

---

## 第三部分：数据结构升级计划

### 3.1 现有结构差距分析

对照辅导员表的 **20 组维度**，现有 `announcements` 表覆盖情况：

| 维度 | 现有字段 | 状态 |
|---|---|---|
| 考试名称/年份 | title（混在标题里） | ⚠️ 无独立字段，无法按考试聚合 |
| 公告时间/网址 | publish_date / url | ✅ |
| 招录人数 | recruit_count | ✅ |
| 报名时间/缴费 | registration_deadline | ⚠️ 只有截止日期，无起止/缴费 |
| 职位表/指南/目录 | — | ❌ 缺失 |
| 报考人数/热度 | — | ❌ 缺失 |
| 笔试时间/科目 | exam_date / exam_subjects | ⚠️ 科目存储为逗号串，无结构 |
| 出分时间/排名 | — | ❌ 缺失（**咨询关键**） |
| 面试时间/形式/名单/比例 | — | ❌ 缺失 |
| 体测/资审 | — | ❌ 缺失 |
| 政策 19 问 | — | ❌ 缺失（独立表） |
| 区域 | region | ✅ |
| 对比（间隔/同比） | — | ❌ 缺失（独立表） |
| 备注/话术 | — | ❌ 缺失 |

### 3.2 升级后的 Schema 设计（新增/扩展）

```sql
-- 1. announcements 表扩展（在现有基础上加列）
ALTER TABLE announcements ADD COLUMN exam_name TEXT;           -- 考试名称（如"26国考""广东事业单位2026"）
ALTER TABLE announcements ADD COLUMN exam_year TEXT;           -- 年份
ALTER TABLE announcements ADD COLUMN exam_stage TEXT;          -- 进度：announced/registering/permit/examined/scored/interviewed/done
ALTER TABLE announcements ADD COLUMN registration_start TEXT;  -- 报名开始时间
ALTER TABLE announcements ADD COLUMN payment_start TEXT;       -- 缴费开始
ALTER TABLE announcements ADD COLUMN payment_deadline TEXT;    -- 缴费截止
ALTER TABLE announcements ADD COLUMN permit_print_time TEXT;   -- 准考证打印
ALTER TABLE announcements ADD COLUMN exam_score_time TEXT;     -- 笔试出成绩时间
ALTER TABLE announcements ADD COLUMN exam_score_rank INTEGER;  -- 是否告知排名 0/1
ALTER TABLE announcements ADD COLUMN interview_time TEXT;      -- 面试时间
ALTER TABLE announcements ADD COLUMN interview_form TEXT;      -- 面试形式
ALTER TABLE announcements ADD COLUMN interview_list_time TEXT; -- 面试名单发布时间
ALTER TABLE announcements ADD COLUMN interview_ratio TEXT;     -- 面试比例
ALTER TABLE announcements ADD COLUMN physical_test_time TEXT;  -- 体测时间
ALTER TABLE announcements ADD COLUMN qualification_review_time TEXT; -- 资格审查时间
ALTER TABLE announcements ADD COLUMN is_known TEXT DEFAULT 'unknown'; -- 缺失语义 known/unknown/na/none
ALTER TABLE announcements ADD COLUMN source_url TEXT;          -- 采集来源 URL（与 url 区分：url 为公告原文）
ALTER TABLE announcements ADD COLUMN compliance_level TEXT DEFAULT 'safe'; -- safe/attribution/restricted
ALTER TABLE announcements ADD COLUMN raw_html_snippet TEXT;    -- 提取用正文片段（受限源为空）

-- 2. 新表：考试资料链接
CREATE TABLE exam_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  material_type TEXT NOT NULL,  -- job_list(职位表)/guide(报考指南)/catalog(专业目录)/faq(常见问题)/other
  title TEXT,
  url TEXT NOT NULL,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id)
);

-- 3. 新表：政策差异（19 问）
CREATE TABLE exam_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL,
  exam_type TEXT NOT NULL,       -- 公考/选调/事考
  question TEXT NOT NULL,        -- 如"退役一年内算应届吗"
  answer TEXT NOT NULL,
  year TEXT,
  source_url TEXT,
  UNIQUE(region, exam_type, question, year)
);

-- 4. 新表：对比数据（自动计算）
CREATE TABLE exam_compare (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_name TEXT NOT NULL,       -- 如"广东省考"
  year TEXT NOT NULL,
  announce_date TEXT,
  exam_date TEXT,
  recruit_count INTEGER,
  applicant_count INTEGER,
  score_date TEXT,
  interview_date TEXT,
  -- 备考周期/面试间隔由程序计算，不存储
  UNIQUE(exam_name, year)
);

-- 5. 新表：备注/话术（辅导员内部）
CREATE TABLE exam_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  note TEXT,
  note_type TEXT DEFAULT 'general',  -- general/warning/speech(话术)/reference
  created_at TEXT,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id)
);
```

### 3.3 关键设计决策

1. **缺失值语义统一**：`is_known` 四态（known/unknown/na/none），前端按状态渲染（灰"待确认"/横杠/文字"无"/正常值）——解决表格"未知/——/无/空"四写法问题
2. **考试聚合**：`exam_name` 字段让"公告"可聚合成"考试"（对应 Excel 的"一考试一行"），支撑详情页时间线
3. **合规分级**：`compliance_level`（safe/attribution/restricted）驱动展示策略——restricted 源（军队文职）不存正文、不展示正文
4. **raw_html_snippet 与 raw_html 分离**：受限源只存片段供提取，普通源存完整（本地 JSON 已含完整 rawHtml）

---

## 第四部分：信息提取方案（并入）

引用 `OPTIMIZATION_PLAN_V2.md` 阶段 1-4 全部内容，核心要点：

| 项 | 方案 |
|---|---|
| 模型 | qwen3-30b-a3b-fp8（成本与 3b 相同，$0/月），JSON Mode 实测不兼容则回退 llama-3.1-8b-instruct-fp8-fast |
| 输出 | `response_format: {type:"json_schema", json_schema:{...}}` 全字段 schema |
| 分层 | 规则优先（日期/人数）→ AI 补缺（科目/类型/地点）→ 置信度审计 |
| 原数据 | raw_html 必须入库（受限源存 snippet） |
| 新增提取字段 | 报名起止/缴费/准考证/出分/排名/面试/体测/资审/资料链接（对齐 3.2 schema） |
| 政策库 | 19 问由 AI 从公告+政策页提取，人工校对入库 |

---

## 第五部分：统一实施路线（合并）

### Phase 0：地基修复（现有系统，约 7h）—— 来自 OPTIMIZATION_PLAN_V2

1. 模型 JSON Mode 实测 → 升级
2. `/api/ai/extract` 重构（JSON Mode + 全字段 schema）
3. `process.js` 分层提取
4. raw_html 入库 + 离线重提取 139 条
5. 自动化接通（crawler.yml Upload D1 + secrets）
6. 前端假数据清理 + 安全加固 + git 提交

### Phase 1：数据结构升级（约 6h）

1. schema 迁移（3.2 全部 DDL）
2. 数据源配置扩展：8 → 30 个源（S级20 + A级10）
3. 合规分级落地（compliance_level + 展示策略 + 免责声明）
4. 缺失值语义统一（is_known + 前端渲染）
5. 考试聚合（exam_name 提取 + 按考试聚合 API）

### Phase 2：考情产品化（约 8h）—— 来自 REQUIREMENTS_V2

1. 考试详情页（全生命周期时间线 + 政策 + 对比）
2. 考情总览升级（真实统计 + 进度徽标）
3. 政策差异库 + 对比分析（自动计算）
4. 辅导员数据维护后台 + Excel 批量导入（6 万条历史）

### Phase 3：智能化（约 6h）—— 来自 REQUIREMENTS_V2

1. 咨询助手（LLM 检索 + 结构化数据，qwen3-30b 免费额度内）
2. 推送提醒（新公告/报名开始/笔试倒计时）
3. 数据质量监控（字段完整率报告 + 异常告警）

### 里程碑验收

| 阶段 | 验收标准 |
|---|---|
| P0 | 字段完整率 >50%、数据自动更新、无假数据 |
| P1 | 30 源接入、军队文职受限合规展示、缺失值四态正确 |
| P2 | 辅导员可替代 Excel 完成 80% 日常查询 |
| P3 | "查表"变"问系统"，历史数据可检索 |

### 成本（全阶段维持 $0/月）

| 项目 | 用量 | 成本 |
|---|---|---|
| Workers AI（qwen3-30b） | 全量重提 6K + 每日增量 2K neurons | $0 |
| Workers/D1/Pages | 免费额度 | $0 |
| GitHub Actions | <100 分钟/月 | $0 |
| **合计** | | **$0/月** |

---

## 附录 A：数据源扩展清单（30 源详细）

**S 级（省级人社厅 + 人事考试网，20 源）**：
山东 hrss.shandong.gov.cn、江苏 jshrss.jiangsu.gov.cn、广东 hrss.gd.gov.cn、北京 rsj.beijing.gov.cn、上海 rsj.sh.gov.cn、重庆 rlsbj.cq.gov.cn、浙江 rlsbt.zj.gov.cn、四川 scpta.com.cn、贵州 rst.guizhou.gov.cn、湖南 rst.hunan.gov.cn、湖北 rst.hubei.gov.cn、河北 rst.hebei.gov.cn、河南 ywzl.hrss.henan.gov.cn、福建 rst.fujian.gov.cn、云南 hrss.yn.gov.cn、广西 gxpta.com.cn、辽宁 lnrsks.com、青海 qhpta.com、天津 zxbm.tjtalents.com.cn、新疆 btpta.xjbt.gov.cn + rst.xinjiang.gov.cn

**A 级（综合平台 + 国央企，10 源）**：
qgsydw.com、gxrc.com 系、hxrc.com、nbrc.com.cn、zhaopin.cnpc.com.cn、zhaopin.sgcc.com.cn、tobacco.gov.cn、et.airchina.com.cn、career.cmbchina.com、job.icbc.com.cn

**受限源（B 级，1 源）**：81rc.81.cn（军队文职，索引-only）

**暂不接入**：公众号 10,842 条、培训机构、报名 SaaS、IP 直连

## 附录 B：合规声明文本（产品页脚）

> 本平台仅对各地政府及官方机构公开发布的招考信息进行结构化聚合与展示，所有公告信息版权归原发布单位所有，以官方发布为准。本平台不转载、不存储公告原文全文，仅展示事实性字段并提供原文链接。如需转载本平台内容请注明来源。

## 附录 C：待确认事项

1. 军队文职来源是否接入（索引-only 方案）——需用户确认接受"仅标题+外链+时间"的展示形态
2. 公众号来源是否需要（人工收录模式 vs 不收录）
3. 国央企是否优先（辅导员咨询中占比高，但每个都是独立系统，配置成本高）
4. 6 万条历史 Excel 数据迁移优先级
