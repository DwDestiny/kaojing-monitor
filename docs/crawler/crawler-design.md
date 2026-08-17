# 爬虫方案设计

## 一、网站技术分析

### 新疆兵团人事考试网（http://btpta.xjbt.gov.cn/）

**技术特征**：
- ✅ **服务端渲染（SSR）**：HTML 直接包含完整内容，无需 JS 渲染
- ✅ **结构规整**：使用传统的列表页 + 详情页结构
- ✅ **URL 规律清晰**：
  - 列表页：`/tzgg/` (通知公告)、`/ksjh/` (考试计划)
  - 详情页：`/c/2026-08-14/8499275.shtml`
  - 分页：`index_2.shtml`, `index_3.shtml`
- ❌ **无 API 接口**：未发现 AJAX 请求，纯静态页面

**HTML 结构**：
```html
<ul class="con">
  <li>
    <span class="fr">2026-08-14</span>
    <a target="_blank" href="/c/2026-08-14/8499275.shtml" title="完整标题">
      显示标题（可能被截断）
    </a>
  </li>
</ul>
```

---

## 二、方案对比

### 方案 A：调用后台接口（API 爬取）

**适用场景**：
- 现代 SPA 应用（React/Vue/Angular）
- 网站有公开的 JSON API
- 移动端 H5 页面（通常有 API）

**优势**：
- ✅ 数据结构化，直接返回 JSON
- ✅ 速度快，流量小
- ✅ 不受页面改版影响（只要 API 不变）

**劣势**：
- ❌ 需要逆向分析接口（请求头、签名、加密）
- ❌ 接口可能有反爬（token、签名验证）
- ❌ 接口可能变动或下线

**新疆兵团网站评估**：
- ❌ **无可用 API**：纯静态页面，没有 AJAX 请求
- **结论**：不适用

---

### 方案 B：传统 HTML 解析（推荐）

**适用场景**：
- 传统政府网站（多为此类）
- 服务端渲染的网站
- 结构规整的列表页

**优势**：
- ✅ 通用性强，适用所有 SSR 网站
- ✅ 不依赖 API，稳定性好
- ✅ 技术成熟（Cheerio/Puppeteer）
- ✅ 易于配置和维护

**劣势**：
- ⚠️ 需要针对每个网站编写 CSS Selector
- ⚠️ 页面改版时需要更新选择器
- ⚠️ 需要处理 HTML 实体、编码问题

**新疆兵团网站评估**：
- ✅ **完美适配**：HTML 结构清晰
- ✅ **易于解析**：列表项结构统一
- ✅ **信息完整**：标题、链接、日期都在 HTML 中

**结论**：✅ 强烈推荐

---

### 方案 C：浏览器自动化（Puppeteer/Playwright）

**适用场景**：
- 需要 JS 渲染的网站
- 有登录/验证码的网站
- 需要模拟用户行为的场景

**优势**：
- ✅ 可处理 JS 动态渲染
- ✅ 可模拟真实浏览器行为
- ✅ 可处理验证码、登录

**劣势**：
- ❌ 资源消耗大（需要启动浏览器）
- ❌ 速度慢（每个页面 1-3 秒）
- ❌ 不适合 Serverless（Cloudflare Workers）

**新疆兵团网站评估**：
- ❌ **过度设计**：页面无 JS 渲染，不需要浏览器
- **结论**：不适用

---

## 三、推荐方案：传统 HTML 解析

### 技术栈
- **HTTP 客户端**：`axios` 或 `node-fetch`
- **HTML 解析**：`cheerio`（类 jQuery 语法）
- **运行环境**：Cloudflare Workers（或 Node.js）

### 核心流程

```javascript
// 1. 获取列表页
const listUrl = 'http://btpta.xjbt.gov.cn/tzgg/';
const html = await fetch(listUrl).then(r => r.text());

// 2. 解析 HTML
const $ = cheerio.load(html);
const items = [];

$('.con ul li').each((i, el) => {
  const $el = $(el);
  const date = $el.find('span.fr').text().trim();
  const $link = $el.find('a');
  const title = $link.attr('title') || $link.text().trim();
  const url = $link.attr('href');
  
  items.push({
    title,
    url: new URL(url, listUrl).href,  // 转绝对路径
    publishDate: date
  });
});

// 3. 爬取详情页（按需）
for (const item of items) {
  const detailHtml = await fetch(item.url).then(r => r.text());
  const $detail = cheerio.load(detailHtml);
  
  // 提取正文内容
  const content = $detail('.article-content').text();
  
  // 提取招考信息（正则匹配）
  item.recruitCount = extractRecruitCount(content);
  item.examDate = extractExamDate(content);
  item.examSubjects = extractExamSubjects(content);
}

// 4. 去重（URL 哈希）
// 5. 存入数据库
```

---

## 四、Selector 配置（可配置化）

为了支持多个网站，我们设计一套配置格式：

```json
{
  "name": "新疆兵团人事考试网",
  "baseUrl": "http://btpta.xjbt.gov.cn",
  "listUrl": "http://btpta.xjbt.gov.cn/tzgg/",
  "selectors": {
    "list": {
      "container": ".con ul",
      "item": "li",
      "title": "a@title",           // @title 表示取属性
      "url": "a@href",
      "date": "span.fr"
    },
    "detail": {
      "content": ".article-content"
    },
    "pagination": {
      "nextPage": ".next-page a@href"
    }
  },
  "extraction": {
    "recruitCount": "regex:(招聘|招考|招募)(\\d+)(人|名)",
    "examDate": "regex:(\\d{4})年(\\d{1,2})月(\\d{1,2})日",
    "examTime": "regex:(\\d{1,2}:\\d{2})[-~](\\d{1,2}:\\d{2})",
    "examSubjects": "regex:考试科目[：:](.*?)(?=\\n|$)"
  }
}
```

---

## 五、实现方案对比

### 方案 1：纯 Cloudflare Workers

**架构**：Workers 定时任务 → 爬取 → 存 D1

**优势**：
- 零成本运行
- 自动扩展
- 全球 CDN

**劣势**：
- CPU 时间限制（50ms/请求）
- 需要拆分任务（每次只爬 1-2 个网站）

**可行性**：✅ 可行，但需要任务拆分

---

### 方案 2：独立爬虫服务 + Cloudflare Workers API

**架构**：
- 爬虫：独立 Node.js 服务（VPS/Heroku）
- API：Cloudflare Workers（读 D1）
- 前端：Cloudflare Pages

**优势**：
- 爬虫无时间限制
- 可以跑大批量任务
- API 仍然用 Serverless（便宜）

**劣势**：
- 需要一台服务器（成本 ~$5/月）

**可行性**：✅ 更稳定，推荐生产环境

---

### 方案 3：混合方案（推荐第一版）

**架构**：
- 轻量爬取：Cloudflare Workers（每小时 1-2 个网站）
- 重度爬取：手动触发（本地运行脚本）
- 数据存储：D1
- 前端：Pages

**优势**：
- 第一版免费
- 快速验证
- 后期可升级到方案 2

**可行性**：✅ 最佳第一版方案

---

## 六、下一步行动

### 立即可做（第一版 MVP）

1. **编写爬虫 Demo**：
   - 用 Node.js + Cheerio 写一个本地脚本
   - 爬取新疆兵团网站前 20 条公告
   - 验证数据提取准确性

2. **初始化数据库**：
   - 创建 D1 数据库
   - 导入 137 个网站的基础信息

3. **测试 5 个网站**：
   - 北京人社局
   - 上海人事考试网
   - 新疆兵团
   - 广东人事考试局
   - 山东人社厅

### 后续优化

- 自动生成 Selector 配置（AI 辅助）
- 异常网站自动暂停
- 爬取频率自适应（热门网站多爬）

---

## 七、成本估算

### 方案 A：纯 Cloudflare（第一版）
- Workers：免费（10 万次/天）
- D1：免费（5GB）
- Pages：免费
- **总成本**：$0/月

### 方案 B：Cloudflare + 独立爬虫
- Cloudflare：$0/月
- VPS（Hetzner）：$5/月
- **总成本**：$5/月

---

## 八、推荐决策

**第一版（MVP）**：
- ✅ 使用**传统 HTML 解析**（方案 B）
- ✅ 部署在 **Cloudflare Workers**（方案 3 混合架构）
- ✅ 优先接入 **5-10 个重点网站**
- ✅ 手动触发 + 每日定时各一次

**生产环境（用户增长后）**：
- 升级到独立爬虫服务
- 每小时自动爬取
- 覆盖 137 个网站

---

**现在我可以开始写第一个爬虫 Demo 了，你觉得怎么样？**
