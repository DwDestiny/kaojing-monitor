# 招考网站爬虫可行性分析报告

## 一、整体情况统计

- **总计网站数**：12 个
- **渲染方式分布**：
  - SSR（服务端渲染）：9 个（75%）
  - HYBRID（混合渲染）：2 个（17%）
  - UNKNOWN（无法访问）：1 个（8%）
- **可行性分布**：
  - HIGH（高可行性）：8 个（67%）
  - MEDIUM（中等可行性）：2 个（17%）
  - BLOCKED（网络受限）：2 个（16%）
- **推荐方案分布**：
  - CHEERIO（HTML 解析）：9 个（75%）
  - PUPPETEER（浏览器自动化）：1 个（8%）
  - API（接口调用）：1 个（8%）
  - SKIP（暂时跳过）：2 个（16%）

---

## 二、可直接用 HTML 解析的网站（CHEERIO）

### 1. 新疆兵团人事考试院
- **URL**：http://btpta.xjbt.gov.cn/wjgb/
- **数据量**：未统计
- **Selector 配置**：
  ```json
  {
    "containerSelector": "div.con ul",
    "itemSelector": "li",
    "titleSelector": "a",
    "urlSelector": "a@href",
    "dateSelector": "span.fr"
  }
  ```
- **特殊说明**：分页为静态文件（index.shtml、index_2.shtml），需处理相对 URL

### 2. 北京市人力资源和社会保障局
- **URL**：https://rsj.beijing.gov.cn/xxgk/tzgg/
- **数据量**：约 10,000 条（100 页）
- **Selector 配置**：
  ```json
  {
    "containerSelector": "ul.list",
    "itemSelector": "ul.list > li",
    "titleSelector": "bt > a",
    "urlSelector": "bt > a@href",
    "dateSelector": "span"
  }
  ```
- **特殊说明**：分页模式为 index.html / index_1.html ... index_99.html，需二次进入详情页提取完整信息

### 3. 北京市市级机关事业单位招聘平台
- **URL**：https://zhaopin.jgj.beijing.gov.cn/Notice.html
- **数据量**：未统计
- **Selector 配置**：
  ```json
  {
    "containerSelector": "div.zp_content",
    "itemSelector": "a",
    "titleSelector": "p",
    "urlSelector": "a@href",
    "dateSelector": "span"
  }
  ```
- **特殊说明**：分页通过 URL 参数 ?page=N 控制，支持搜索 ?name=XXX

### 4. 天津市人力资源和社会保障局
- **URL**：https://hrss.tj.gov.cn/xinwenzixun/gggsnew/
- **数据量**：未统计
- **Selector 配置**：
  ```json
  {
    "containerSelector": "div.con-listcon ul",
    "itemSelector": "li",
    "titleSelector": "a@title",
    "urlSelector": "a@href",
    "dateSelector": "span.fr"
  }
  ```
- **特殊说明**：无反爬虫机制，URL 为相对路径需转换

### 5. 重庆市人力资源和社会保障局
- **URL**：https://rlsbj.cq.gov.cn/tzgg/
- **数据量**：未统计
- **Selector 配置**（待验证）：
  ```json
  {
    "containerSelector": "待确认",
    "itemSelector": "li, tr, div.list-item",
    "titleSelector": "a, span.title",
    "urlSelector": "a@href",
    "dateSelector": "span.date, td:last-child"
  }
  ```
- **特殊说明**：无法直接访问，需 VPN/代理，可能有反爬虫策略

### 6. 广东省人力资源和社会保障厅
- **URL**：https://hrss.gd.gov.cn/zwgk/sydwzp/index.html
- **数据量**：约 1,985 条（200 页）
- **Selector 配置**：
  ```json
  {
    "containerSelector": "ul.list",
    "itemSelector": "li",
    "titleSelector": "a@title",
    "urlSelector": "a@href",
    "dateSelector": "span.pubDate"
  }
  ```
- **特殊说明**：无反爬虫机制，分页规律清晰（index.html / index_2.html ... index_200.html）

### 7. 山东省人力资源和社会保障厅
- **URL**：https://hrss.shandong.gov.cn/channels/ch00232/
- **数据量**：约 1,506 条
- **Selector 配置**：
  ```json
  {
    "containerSelector": "div.news_box01_con ul",
    "itemSelector": "li.pagedContent",
    "titleSelector": "span.news_box01_title",
    "urlSelector": "a@href",
    "dateSelector": "span:nth-of-type(2)"
  }
  ```
- **特殊说明**：前 50 页客户端分页，51 页起需请求 index_1.shtml / index_2.shtml

### 8. 福建省人力资源和社会保障厅
- **URL**：https://rst.fujian.gov.cn/zw/gsgg/
- **数据量**：约 1,048 条
- **Selector 配置**：
  ```json
  {
    "containerSelector": "ul.clearflx.nyncgl-box-list",
    "itemSelector": "li",
    "titleSelector": "p",
    "urlSelector": "a@href",
    "dateSelector": "span.bf-pass"
  }
  ```
- **特殊说明**：前 7 页静态 HTML 可直接爬取，第 8+ 页需 JavaScript 执行（建议 MVP 先爬前 7 页）

---

## 三、需要浏览器的网站（PUPPETEER）

### 1. 浙江省人力资源和社会保障厅
- **URL**：https://rlsbt.zj.gov.cn/col/col1229743683/index.html
- **数据量**：未统计
- **原因**：
  - 基于 Jcms CMS，列表页使用 JavaScript 动态加载（AuthorizedRead/unitbuild.js）
  - 有反爬虫机制（User-Agent 检查、速率限制 X-RateLimit-Limit: 1000）
  - 首页展示最新公告为 SSR，但完整列表需浏览器渲染
- **建议**：使用 Puppeteer 处理列表分页，或直接爬取详情页（详情页为完整 SSR）

---

## 四、可用 API 的网站

### 1. 江苏省人力资源和社会保障厅
- **URL**：https://jshrss.jiangsu.gov.cn/col/col78503/index.html
- **API 端点**：https://jshrss.jiangsu.gov.cn/module/web/jpage/dataproxy.jsp
- **数据量**：
  - 公示公告栏目（col78503）：481 条，5 页
  - 招考录用栏目（col57253）：包含省属及各地市事业单位招聘
- **数据格式**：XML
- **备选方案**：HTML SSR 渲染完整，CHEERIO 解析也可行
- **建议**：优先使用 API 方式，更稳定

---

## 五、暂时无法接入的网站

### 1. 上海市人力资源和社会保障局
- **URL**：https://hrss.sh.gov.cn
- **原因**：企业网络安全策略阻止，无法通过 WebFetch 访问
- **解决方案**：
  - 在国内网络环境或使用代理直接访问
  - 确认招聘公告是否在其他渠道发布（如"随申办"小程序）
  - 参考天津人社网结构，推测可能采用 SSR + HTML 选择器方案

### 2. 上海市公务员局
- **URL**：https://apta.sh.gov.cn
- **原因**：本地代理配置与目标网站 SSL 握手失败（SSL_ERROR_SYSCALL）
- **解决方案**：
  - 检查网络代理配置，移除或绕过本地代理后重试
  - 在无代理环境中测试
  - 网络可通后预计为 SSR 类型，可用 CHEERIO 实现

---

## 六、自动化部署方案

### 1. Cloudflare Workers 覆盖率评估
- **完全支持**（9 个）：所有 CHEERIO 推荐的网站均可在 Cloudflare Workers 上运行
  - 优点：无服务器成本，响应速度快，自动扩展
  - 限制：单次请求 CPU 时间 50ms（免费版）/ 50ms（付费版首次请求）
- **不支持**（1 个）：浙江省人社厅需 Puppeteer，Cloudflare Workers 不支持完整浏览器环境
- **需验证**（2 个）：上海两个网站需先解决网络访问问题

### 2. 是否需要独立服务器运行 Puppeteer
- **需要**：仅浙江省人社厅 1 个网站
- **方案选择**：
  - 方案 A：使用 Cloudflare Workers + Browserless API（付费服务，按次计费）
  - 方案 B：部署独立 Node.js 服务器（如 Render / Railway / Fly.io 免费层）
  - 方案 C：暂时跳过该网站，或只爬取首页最新公告（SSR 可用 CHEERIO）
- **推荐**：MVP 阶段选择方案 C，后期按需扩展

### 3. 定时任务频率建议
- **高频网站**（每日更新 > 5 条）：每 6 小时执行一次
  - 北京市人社局、广东省人社厅
- **中频网站**（每日更新 1-5 条）：每 12 小时执行一次
  - 天津、山东、福建、江苏
- **低频网站**（每周更新 < 5 条）：每 24 小时执行一次
  - 新疆兵团、北京市级机关、重庆
- **实现方式**：Cloudflare Workers Cron Triggers（免费 3 个定时任务）或 GitHub Actions（每 15 分钟限制一次）

### 4. 预估成本
#### Cloudflare Workers 方案（推荐）
- **免费额度**：
  - 每天 100,000 次请求
  - 3 个 Cron Triggers
- **付费版**（$5/月）：
  - 1000 万次请求/月
  - 无限 Cron Triggers
- **预估**：MVP 阶段完全在免费额度内

#### 独立服务器方案（备选）
- **Render**：免费层（每月 750 小时，15 分钟无请求自动休眠）
- **Railway**：免费层（每月 $5 额度，约 500 小时运行时间）
- **Fly.io**：免费层（3 个 shared-cpu-1x VM，256MB RAM）
- **预估**：MVP 阶段使用免费层即可

---

## 七、下一步行动

### 1. 优先接入的 5-10 个网站（按可行性和重要性排序）

#### 第一批（立即接入）
1. **广东省人社厅**（HIGH 可行性，1,985 条数据，无反爬虫）
2. **山东省人社厅**（HIGH 可行性，1,506 条数据，结构清晰）
3. **江苏省人社厅**（HIGH 可行性，有 API 接口，最稳定）
4. **天津市人社局**（HIGH 可行性，无反爬虫）
5. **北京市人社局**（HIGH 可行性，数据量最大）

#### 第二批（一周内接入）
6. **福建省人社厅**（HIGH 可行性，前 7 页静态 HTML）
7. **北京市级机关招聘平台**（HIGH 可行性，专门招聘网站）
8. **新疆兵团人事考试院**（HIGH 可行性，西部地区覆盖）

#### 第三批（按需接入）
9. **重庆市人社局**（MEDIUM 可行性，需验证网络访问）
10. **浙江省人社厅**（MEDIUM 可行性，需 Puppeteer 或只爬首页）

#### 暂时搁置
- 上海市人社局（网络受限）
- 上海市公务员局（网络受限）

### 2. 需要生成的 selector 配置文件

创建 `/config/selectors.json`：
```json
{
  "sites": [
    {
      "id": "guangdong_hrss",
      "name": "广东省人力资源和社会保障厅",
      "enabled": true,
      "listPageUrl": "https://hrss.gd.gov.cn/zwgk/sydwzp/index.html",
      "paginationPattern": "index_{page}.html",
      "totalPages": 200,
      "containerSelector": "ul.list",
      "itemSelector": "li",
      "titleSelector": "a@title",
      "urlSelector": "a@href",
      "dateSelector": "span.pubDate",
      "urlType": "relative",
      "baseUrl": "https://hrss.gd.gov.cn/zwgk/sydwzp/"
    }
    // ... 其他网站配置
  ]
}
```

### 3. 需要特殊处理的问题

#### 问题 1：相对 URL 转换
- **影响网站**：北京、天津、新疆兵团、山东、福建
- **解决方案**：编写 `resolveUrl(baseUrl, relativeUrl)` 工具函数

#### 问题 2：分页模式差异
- **静态文件分页**：新疆兵团（index.shtml / index_2.shtml）
- **URL 参数分页**：北京市级机关（?page=N）
- **文件名分页**：广东、山东（index.html / index_2.html）
- **客户端分页**：山东前 50 页（需提取 JavaScript 变量）
- **解决方案**：配置文件中增加 `paginationType` 字段，分别处理

#### 问题 3：详情页二次提取
- **影响网站**：北京市人社局（列表页不含完整标题和日期）
- **解决方案**：爬取列表页获取 URL → 批量请求详情页 → 提取完整信息

#### 问题 4：江苏省 API 调用
- **数据格式**：XML（非 JSON）
- **解决方案**：使用 `xml2js` 或 `fast-xml-parser` 库解析

#### 问题 5：反爬虫策略
- **影响网站**：浙江（速率限制）、重庆（可能有 User-Agent 检查）
- **解决方案**：
  - 设置合理的 User-Agent
  - 控制请求频率（每个网站间隔 1-2 秒）
  - 使用 Cloudflare Workers 的分布式 IP

---

## 附录：技术栈建议

### MVP 阶段（Week 1-2）
- **爬虫引擎**：Cloudflare Workers + Cheerio
- **数据存储**：Cloudflare D1（SQLite）或 Supabase（PostgreSQL）
- **定时任务**：Cloudflare Cron Triggers
- **前端展示**：Next.js + Cloudflare Pages

### 扩展阶段（Week 3+）
- 增加 Puppeteer 支持（独立服务或 Browserless API）
- 增加错误监控（Sentry）
- 增加数据去重与更新检测
- 增加全文搜索（Algolia / Meilisearch）
