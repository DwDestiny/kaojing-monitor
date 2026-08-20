# P1C 任务包：禁用源接入（API 模式适配）+ 军队文职索引-only

> **日期**：2026-08-20
> **来源**：用户确认"继续推进"（优先级 1：3 个禁用源 + 优先级 2：军队文职）
> **开发规范**：docs/standards/ 三件套——**强制必读**
> **流程纪律**：**TDD（红→绿→重构）→ 规范自查 → 实测验证 → 部署验收**，每个功能有测试，杜绝返工

---

## 任务总览

| ID | 任务 | 领域 | 验收标准 |
|---|---|---|---|
| C1 | engine JSON API 模式扩展 | 爬虫 | crawlApi 支持 apiType='json'（数组响应 + HTML 字符串响应/cheerio 解析 + GET/POST + 分页参数注入），测试全绿 |
| C2 | 浙江人社厅接入（zhejiang_hrss） | 爬虫 | jcms API 网关实测 → 配置 → 列表抓取 ≥5 条有效 |
| C3 | 河北人社厅接入（hebei_hrss） | 爬虫 | Vue SPA JSON API 实测 → 配置 → 列表抓取 ≥5 条有效 |
| C4 | 黑龙江接入（heilongjiang_hrss） | 爬虫 | gkzp.renshenet.org.cn 调研 → 配置 → 列表抓取 ≥5 条有效 |
| C5 | 军队文职索引-only（81rc.81.cn） | 爬虫+合规 | restricted 源接入：仅标题/URL/时间，不存 raw_html；前端"以官网为准"标注 |
| C6 | 审查 + VPS 同步 + 全链路验收 + 提交 | 全栈 | 4 新源全链路通过、线上数据正确、VPS cron 覆盖新源、git 干净 |

---

## C1：engine JSON API 模式（TDD）

**现状**：`crawlApi` 仅支持江苏 XML API（apiType='xml'，datastore.recordset.record）。新源是 JSON API，分两种形态：
- **形态 A（JSON 数组）**：河北 `POST /rsmhapi/door/listArticleByTab`，返回 `{...文章数组...}` 或 `{data: [...]}`
- **形态 B（HTML 字符串）**：浙江 jcms，`GET /api-gateway/jpaas-publish-server/front/page/build/unit?pageId=...` 返回 `{data: {html: "<li><a class='bt_link'>标题</a><span class='bt_time'>日期</span></li>"}}`

**配置设计**（sites.json 扩展字段）：
```json
{
  "paginationType": "api",
  "apiType": "json",
  "apiUrl": "https://...",
  "apiMethod": "GET | POST",
  "apiHeaders": { "Content-Type": "application/json" },
  "apiParams": { "pageId": "1229743683" },
  "apiBody": { "sectionId": 1006 },
  "itemsPath": "data.list | data.rows | data",
  "htmlPath": "data.html",
  "itemContainer": "li",
  "titleSelector": "a.bt_link",
  "urlSelector": "a.bt_link",
  "urlAttr": "href",
  "dateSelector": "span.bt_time",
  "paginationParam": "pageNo | pageNum | page",
  "baseUrl": "..."
}
```

**分页注入**：
- 形态 A：body/query 注入 `pageNum`（河北）或 `pageNo`
- 形态 B：query 注入 `paramJson={"pageNo":N,"pageSize":20}`（浙江）

**测试用例**（`crawlers/test/api-mode.test.js`）：
1. buildApiRequest：GET + query 注入 pageNum=2
2. buildApiRequest：POST + body 注入 pageNum=2
3. parseJsonItems：形态 A 数组路径 `data.list`
4. parseJsonItems：形态 B htmlPath + cheerio 解析 li → [{title,url,date}]
5. 无 itemsPath/htmlPath 配置 → 报错

**实现**：改 `core/engine.js` crawlApi 分支 + 新增 `core/api-json.js`（纯函数，可测）。

---

## C2：浙江人社厅（zhejiang_hrss）

**已知**（子代理调研）：jcms 全采通，列表经 API 网关异步加载：
`GET https://rlsbt.zj.gov.cn/api-gateway/jpaas-publish-server/front/page/build/unit?parseType=bulidstatic&webId=2758&tplSetId=kUBgoFENJiaYxr31jYEph&pageType=column&tagId=<栏目列表>&editType=null&pageId=1229743683`
- 返回 `data.html` 内含 `<li><a class="bt_link" title="标题">标题</a><span class="bt_time">YYYY-MM-DD</span></li>`
- 分页：`paramJson={"pageNo":N,"pageSize":20}`

**步骤**：实测 API 返回结构 → 配置 sites.json → 列表验证 ≥5 条 → 详情页验证。

---

## C3：河北人社厅（hebei_hrss）

**已知**：全站 Vue SPA，数据走 JSON API：
`POST https://rst.hebei.gov.cn/rsmhapi/door/listArticleByTab` body `{sectionId, pageNum, pageSize}`
- 栏目 id 见 `GET /rsmhapi/door/section/one/level`，'通知公告'=1006
- 详情页 `https://rst.hebei.gov.cn/pageWarp?isId=<文章id>`

**步骤**：实测 API 返回结构 + 栏目 id → 配置 → 列表验证 → 详情验证（含正文提取）。

---

## C4：黑龙江（heilongjiang_hrss → gkzp.renshenet.org.cn）

**已知**：hrss.hlj.gov.cn 无招聘专版（统招公告混发通知公告），官方主渠道为"黑龙江省事业单位公开招聘服务平台" gkzp.renshenet.org.cn。

**步骤**：调研 gkzp.renshenet.org.cn 列表页结构（可能是 HTML 静态或 API）→ 配置 → 列表验证 ≥5 条。

---

## C5：军队文职索引-only（81rc.81.cn）

**合规**：MASTER_UPGRADE_PLAN §2——军队人才网为"唯一指定网站"，**仅存标题+URL+时间，不存 raw_html**，complianceLevel='restricted'。

**前端**：详情页"数据来源"显示"信息来源：军队人才网（以官网为准）"；列表正常展示标题/时间/外链。

**步骤**：调研 81rc.81.cn 公告列表结构（https://81rc.81.cn/ 或招考公告频道）→ 配置（complianceLevel=restricted）→ 验证：入库时 raw_html 为空/仅 snippet、前端标注。

**后端**：/api/import 已有 restricted 处理（raw_html 截断 2000 字符）→ 爬虫侧 restricted 源**不抓详情**（process.js 需支持：restricted 源跳过 fetchAllDetails）。

---

## C6：审查 + 部署 + 验收 + 提交

1. **审查**：engine/api-json.js 按 BACKEND_STANDARD（命名/错误处理/禁止吞错）
2. **本地全链路**：4 新源 processData（列表+详情+提取+规则清洗）
3. **VPS 同步**：rsync crawlers → VPS，跑一轮全量验证新源入库
4. **前端**：restricted 展示标注 + 测试
5. **提交**：代码 + sites.json + 文档 + 工作日志

---

## 流程（每个任务遵守）

```
① 写测试（先红）→ ② 实现（转绿）→ ③ 实测验证（真实网络）→ ④ 规范自查 → ⑤ 部署验收 → ⑥ 记录
```
