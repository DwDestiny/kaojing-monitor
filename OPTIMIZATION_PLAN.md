# 考情监测系统 - 优化方案

版本：v1.0  
日期：2026-08-17  
状态：待审批

---

## 执行摘要

本优化方案针对考情监测系统当前存在的 **数据质量致命缺陷** 和 **用户体验问题**，提出分 3 阶段、总计 18.5 小时的系统性改进方案。

**核心问题**：
1. 🔴 详情页未爬取 → 核心字段全 NULL → 产品价值归零
2. 🔴 数据混入垃圾内容 → 有效数据 < 50% → 用户体验极差
3. 🟠 前端交互缺陷 → 筛选器触发跳顶 → 连续操作割裂

**预期收益**：
- 核心字段提取成功率：0% → 70%+
- 有效数据占比：< 50% → 80%+
- 用户体验评分：2/5 → 4/5

---

## 问题诊断

### 根本原因分析

```
设计文档 ✅ → 实现代码 ❌ → 交付声明 ✅（虚假）
```

**技术债务链条**：
1. `docs/crawler/crawler-design.md` 明确写了"第 3 步：爬取详情页并提取"
2. 实际代码只实现了步骤 1-2（爬列表页、去重）
3. `FINAL_DELIVERY.md` 声称"爬虫 100% 完成"
4. 数据库有 1424 条记录，但核心字段全 NULL

**影响面评估**：
| 模块 | 状态 | 影响 |
|------|------|------|
| 数据采集 | 🔴 50% 完成 | 只有标题和链接 |
| 数据提取 | 🔴 0% 生效 | 提取器空转 |
| 数据过滤 | 🔴 未实现 | 垃圾数据占比 > 50% |
| 定时更新 | 🔴 未实现 | 数据永远不更新 |
| 前端展示 | 🟡 90% 完成 | 筛选器交互有缺陷 |
| 后端 API | 🟢 100% 完成 | 功能正常 |

---

## 优化方案架构

### 整体流程设计

#### 当前流程（错误）

```
爬列表页 → 获取标题+URL → 提取字段（失败，rawHtml 只是列表项） → 入库
                                          ↓
                                     全字段 NULL
```

#### 修复后流程（正确）

```
爬列表页 → AI 过滤（去除垃圾） → 爬详情页 → 提取字段（正则 + LLM） → 入库
   ↓            ↓                  ↓              ↓                ↓
 200 条      保留 100 条        获取正文       70% 成功率      100 条有效数据
```

---

## 第一阶段：核心功能修复（P0 + P1）

**目标**：让产品"能用"  
**工期**：9.5 小时  
**优先级**：立即执行

### 任务 1.1：实现详情页爬取 ⭐⭐⭐

**Issue**：[#1](https://github.com/DwDestiny/kaojing-monitor/issues/1)  
**工时**：4 小时  
**执行者**：grok-coder（`-m grok-4.5 --effort high`）

#### 技术方案

**新增函数**：`crawlers/core/detail-fetcher.js`

```javascript
import axios from 'axios';
import * as cheerio from 'cheerio';
import { sleep, randomDelay } from './utils.js';

/**
 * 爬取详情页内容
 * @param {Array} announcements - 列表页爬取的公告数组
 * @returns {Promise<Array>} 包含详情页内容的公告数组
 */
export async function fetchAllDetails(announcements) {
  const results = [];
  
  console.log(`\n📖 开始爬取 ${announcements.length} 个详情页...`);
  
  for (let i = 0; i < announcements.length; i++) {
    const item = announcements[i];
    
    try {
      console.log(`  [${i + 1}/${announcements.length}] ${item.url}`);
      
      const html = await axios.get(item.url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'KaoQingBot/1.0',
        },
      }).then(r => r.data);
      
      const $ = cheerio.load(html);
      
      // 通用正文提取（按优先级尝试多个选择器）
      const contentSelectors = [
        '.article-content',
        '.content',
        '.detail-content',
        'article',
        '.main-content',
        '#content',
      ];
      
      let content = '';
      for (const selector of contentSelectors) {
        const $content = $(selector);
        if ($content.length > 0) {
          content = $content.html();
          break;
        }
      }
      
      // 如果没有找到标准容器，提取 body 主要部分
      if (!content || content.length < 200) {
        content = $('body').html();
      }
      
      results.push({
        ...item,
        rawHtml: content,  // 替换为详情页完整 HTML
      });
      
      // 礼貌爬取：随机延迟 1-3 秒
      if (i < announcements.length - 1) {
        await sleep(randomDelay(1000, 3000));
      }
      
    } catch (err) {
      console.error(`  ⚠️  详情页爬取失败: ${err.message}`);
      // 失败时保留原数据（列表页 HTML）
      results.push(item);
    }
  }
  
  console.log(`✅ 详情页爬取完成，成功 ${results.length} 个\n`);
  return results;
}
```

**修改文件**：`crawlers/process.js`

```javascript
import { fetchAllDetails } from './core/detail-fetcher.js';

export async function processData(siteConfig, options = {}) {
  console.log(`\n处理网站: ${siteConfig.name}`);

  // 1. 爬取列表页
  console.log('  [1/5] 爬取列表页...');
  const rawData = await crawl(siteConfig, options);
  console.log(`  ✓ 爬取 ${rawData.length} 条`);

  // 2. 爬取详情页（新增）
  console.log('  [2/5] 爬取详情页...');
  const withDetails = await fetchAllDetails(rawData);
  console.log(`  ✓ 详情页爬取完成`);

  // 3. 提取字段
  console.log('  [3/5] 提取字段...');
  const extracted = batchExtract(withDetails);
  console.log(`  ✓ 提取完成`);

  // 4. 去重
  console.log('  [4/5] 去重...');
  const deduplicated = deduplicateByUrl(extracted);
  console.log(`  ✓ 去重后 ${deduplicated.length} 条`);

  // 5. 添加 hash
  console.log('  [5/5] 添加 hash...');
  const withHashes = addHashes(deduplicated);
  console.log(`  ✓ 处理完成`);

  return withHashes;
}
```

#### 验收标准

- [ ] 数据库中 `rawHtml` 字段包含详情页完整 HTML（长度 > 1000 字符）
- [ ] `recruit_count` 非 NULL 占比 > 30%
- [ ] `exam_date` 非 NULL 占比 > 20%
- [ ] `exam_subjects` 非 NULL 占比 > 20%

#### 风险

- **爬取速度慢**：100 条数据 × 2 秒延迟 = 3.3 分钟
- **详情页结构差异**：部分网站可能需要特殊选择器
- **反爬风险**：频繁请求可能被封 IP

**缓解措施**：
- 分批爬取（每次 20-30 条）
- 记录失败 URL，手动排查
- 增加 User-Agent 池

---

### 任务 1.2：接入 Cloudflare Workers AI 做内容过滤 ⭐⭐⭐

**Issue**：[#2](https://github.com/DwDestiny/kaojing-monitor/issues/2)  
**工时**：3 小时  
**执行者**：grok-coder

#### 技术方案

**新增文件**：`crawlers/core/ai-filter.js`

```javascript
/**
 * AI 内容过滤器
 * 使用 Cloudflare Workers AI 判断是否为招考公告
 */

export async function filterAnnouncements(announcements, env) {
  if (!env?.AI) {
    console.warn('⚠️  AI 环境不可用，跳过过滤');
    return announcements;
  }
  
  console.log(`\n🤖 AI 过滤: ${announcements.length} 条数据`);
  
  const results = [];
  const filtered = [];
  
  for (const item of announcements) {
    try {
      const isValid = await isRecruitmentAnnouncement(item.title, env);
      
      if (isValid) {
        results.push(item);
      } else {
        filtered.push(item.title);
        console.log(`  ❌ 过滤: ${item.title}`);
      }
      
    } catch (err) {
      console.error(`  ⚠️  AI 判断失败: ${err.message}`);
      // 失败时保守策略：保留数据
      results.push(item);
    }
  }
  
  console.log(`✅ 过滤完成: 保留 ${results.length} 条，过滤 ${filtered.length} 条\n`);
  return results;
}

/**
 * 判断标题是否为招考公告
 */
async function isRecruitmentAnnouncement(title, env) {
  // 快速规则过滤（优先级高，避免浪费 AI 额度）
  const blacklist = ['证书发放', '档案', '公示名单', '拟聘用', '体检通知', '资格审查'];
  for (const keyword of blacklist) {
    if (title.includes(keyword)) {
      return false;
    }
  }
  
  const whitelist = ['招聘', '招考', '招录', '公开招', '遴选', '选调'];
  for (const keyword of whitelist) {
    if (title.includes(keyword)) {
      return true;
    }
  }
  
  // 模糊情况调用 AI
  const ai = new env.AI('@cf/meta/llama-3.1-8b-instruct');
  
  const response = await ai.run({
    messages: [
      {
        role: 'system',
        content: '你是招考公告分类器。判断标题是否为招聘/招考公告（事业单位、公务员、教师、医疗等）。只回复 YES 或 NO。',
      },
      {
        role: 'user',
        content: `标题：${title}`,
      },
    ],
  });
  
  const answer = response.response.trim().toUpperCase();
  return answer === 'YES';
}
```

**流程插入**：`crawlers/process.js`

```javascript
import { filterAnnouncements } from './core/ai-filter.js';

export async function processData(siteConfig, options = {}) {
  // 1. 爬取列表页
  const rawData = await crawl(siteConfig, options);
  
  // 2. AI 过滤（新增）
  console.log('  [2/6] AI 内容过滤...');
  const filtered = await filterAnnouncements(rawData, options.env);
  console.log(`  ✓ 过滤后 ${filtered.length} 条`);
  
  // 3. 爬取详情页
  const withDetails = await fetchAllDetails(filtered);
  
  // ... 后续步骤
}
```

#### API 配置

**修改**：`api/wrangler.toml`

```toml
# 添加 AI 绑定
[ai]
binding = "AI"
```

**环境传递**：爬虫需要在 Workers 环境中运行才能访问 `env.AI`

#### 验收标准

- [ ] 数据库中不再出现"证书发放"、"档案攻略"、"公示名单"
- [ ] 有效招考公告占比 > 80%
- [ ] AI 调用成功率 > 95%

#### 成本控制

| 场景 | 日调用量 | 月调用量 | 免费额度 | 超额成本 |
|------|---------|---------|---------|---------|
| 列表页过滤 | 200 | 6,000 | 10,000 | $0 |
| 模糊判断 | ~50 | 1,500 | 包含在上面 | $0 |
| **合计** | 250 | 7,500 | 10,000 | **$0/月** |

---

### 任务 1.3：修复前端筛选器跳顶 ⭐

**Issue**：[#3](https://github.com/DwDestiny/kaojing-monitor/issues/3)  
**工时**：0.5 小时  
**执行者**：grok-coder

#### 技术方案

**方案选择**：方案 2（纯客户端处理，无需改 Link）

**修改文件**：`frontend/components/HomeClient.tsx`

```typescript
useEffect(() => {
  setLoading(true);
  setListError(null);

  Promise.all([...])
    .then([...])
    .finally(() => {
      setLoading(false);
      
      // 筛选完成后滚动到列表顶部
      setTimeout(() => {
        const listElement = document.getElementById('announcements');
        if (listElement) {
          const offset = 80; // 顶部导航栏高度
          const elementTop = listElement.getBoundingClientRect().top;
          const scrollTop = window.scrollY || window.pageYOffset;
          
          // 只在当前位置高于列表时才滚动
          if (scrollTop > listElement.offsetTop - offset) {
            window.scrollTo({
              top: listElement.offsetTop - offset,
              behavior: 'smooth'
            });
          }
        }
      }, 100);
    });
}, [region, examType, subject, page]);
```

#### 验收标准

- [ ] 点击任意筛选器，页面停留在列表顶部
- [ ] 首次加载不触发滚动
- [ ] 滚动行为流畅（smooth）

---

### 任务 1.4：实现 Workers Cron 定时爬取 ⭐⭐

**Issue**：[#4](https://github.com/DwDestiny/kaojing-monitor/issues/4)  
**工时**：2 小时  
**执行者**：grok-coder

#### 技术方案

**挑战**：
- Cloudflare Workers CPU 时间限制（50ms/请求）
- 爬取 5 个网站 × 20 条/网站 × 2 秒延迟 = 200 秒（超时）

**解决方案**：轻量级 Cron + 重度任务外置

```javascript
// api/src/index.js
async scheduled(event, env, ctx) {
  console.log('Cron triggered:', event.cron);
  
  // 方案 A：只爬 API 类网站（快速）
  const sites = await env.DB.prepare(`
    SELECT * FROM source_websites 
    WHERE status = 'active' AND pagination_type = 'api'
    LIMIT 3
  `).all();
  
  for (const site of sites.results) {
    try {
      // API 类爬取不需要延迟，可在 Workers 内完成
      const config = JSON.parse(site.selector_config);
      const data = await crawlApi(config);
      
      // 简化版提取（只用正则，不调 LLM）
      const extracted = extractFieldsSimple(data);
      
      // 批量插入
      await batchInsert(extracted, env);
      
    } catch (err) {
      console.error(`Crawl failed: ${site.name}`, err);
    }
  }
}
```

**方案 B**（推荐）：Cron 触发外部爬虫

```javascript
async scheduled(event, env, ctx) {
  // Workers Cron 只触发，实际爬取由外部服务执行
  await fetch('https://your-crawler-server.com/trigger', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.CRAWLER_TOKEN}` }
  });
}
```

外部爬虫：
- 部署在 VPS/Heroku（$0-5/月）
- 或使用 GitHub Actions（免费，2000 分钟/月）

#### 验收标准

- [ ] 每天 2:07 和 14:23 Cron 执行（查看 Workers 日志）
- [ ] `crawl_logs` 表有记录
- [ ] 新数据进入 `announcements` 表

---

## 第二阶段：数据质量提升（P2）

**目标**：提高字段提取准确率  
**工期**：4 小时  
**优先级**：第一阶段完成后执行

### 任务 2.1：LLM 辅助字段提取 ⭐⭐

**Issue**：[#5](https://github.com/DwDestiny/kaojing-monitor/issues/5)  
**工时**：4 小时  
**依赖**：任务 1.1（详情页爬取）

#### 技术方案

**策略**：正则优先，失败时 LLM 补充

```javascript
// crawlers/core/extractor.js
export async function extractFields(announcement, env) {
  // 1. 正则提取（快速）
  let fields = extractWithRegex(announcement);
  
  // 2. 检查核心字段完整性
  const hasCoreFields = 
    fields.recruitCount && 
    fields.examDate && 
    fields.examSubjects?.length > 0;
  
  if (!hasCoreFields && env?.AI) {
    // 3. LLM 补充
    console.log(`  🤖 调用 LLM 辅助提取: ${announcement.title}`);
    const llmFields = await extractWithAI(announcement.rawHtml, env);
    
    // 合并结果（LLM 补充缺失字段）
    fields = {
      recruitCount: fields.recruitCount || llmFields.recruitCount,
      examDate: fields.examDate || llmFields.examDate,
      examSubjects: fields.examSubjects?.length > 0 
        ? fields.examSubjects 
        : llmFields.examSubjects,
      examTime: fields.examTime || llmFields.examTime,
      // ... 其他字段
    };
  }
  
  return fields;
}

async function extractWithAI(html, env) {
  // 清理 HTML 标签
  const text = cleanHtml(html).slice(0, 2000); // 限制长度
  
  const ai = new env.AI('@cf/meta/llama-3.1-8b-instruct');
  
  const prompt = `
从以下招考公告中提取信息，以 JSON 格式输出：
{
  "recruitCount": 数字或null,
  "examDate": "YYYY-MM-DD"或null,
  "examSubjects": ["科目1", "科目2"]或[],
  "examTime": "HH:MM-HH:MM"或null
}

公告内容：
${text}
`;

  const response = await ai.run({
    messages: [
      { role: 'system', content: '你是招考信息提取专家。只输出 JSON，不要额外文字。' },
      { role: 'user', content: prompt }
    ]
  });
  
  try {
    return JSON.parse(response.response);
  } catch (err) {
    console.error('LLM 返回格式错误:', response.response);
    return {};
  }
}
```

#### 验收标准

- [ ] 核心字段提取成功率 > 70%
- [ ] NULL 占比 < 30%
- [ ] LLM 调用成功率 > 90%

---

## 第三阶段：可观测性与维护性（P3）

**目标**：便于监控和调试  
**工期**：5 小时  
**优先级**：后续优化

### 任务 3.1：数据质量监控 ⭐

**Issue**：[#6](https://github.com/DwDestiny/kaojing-monitor/issues/6)  
**工时**：2 小时

#### API 设计

**新增接口**：`GET /api/quality-report`

```json
{
  "overview": {
    "totalAnnouncements": 1424,
    "activeAnnouncements": 1380,
    "lastUpdate": "2026-08-17T14:23:00Z"
  },
  "fieldCompleteness": {
    "recruitCount": { "filled": 450, "ratio": "32%" },
    "examDate": { "filled": 280, "ratio": "20%" },
    "examSubjects": { "filled": 120, "ratio": "8%" },
    "examTime": { "filled": 95, "ratio": "7%" }
  },
  "dataQuality": {
    "avgFieldsPerAnnouncement": 2.3,
    "fullyCompletedRatio": "5%",
    "emptyAnnouncementsCount": 200
  },
  "crawlStatus": {
    "totalWebsites": 8,
    "activeWebsites": 8,
    "lastCrawlSuccess": 6,
    "lastCrawlFailed": 2
  }
}
```

#### 实现

```javascript
// api/src/index.js
async function getQualityReport(env) {
  const [overview, completeness, quality, crawl] = await Promise.all([
    getOverviewStats(env),
    getFieldCompleteness(env),
    getDataQualityMetrics(env),
    getCrawlStatus(env)
  ]);
  
  return jsonResponse({
    overview,
    fieldCompleteness: completeness,
    dataQuality: quality,
    crawlStatus: crawl
  });
}
```

---

### 任务 3.2：爬虫健康状态面板 ⭐

**Issue**：[#7](https://github.com/DwDestiny/kaojing-monitor/issues/7)  
**工时**：3 小时

#### API 设计

**新增接口**：`GET /api/crawl-status`

```json
{
  "lastCrawl": "2026-08-17T14:23:00Z",
  "nextCrawl": "2026-08-18T02:07:00Z",
  "websites": [
    {
      "id": 1,
      "name": "山东省人社厅",
      "status": "active",
      "lastCrawlAt": "2026-08-17T14:23:00Z",
      "lastCrawlCount": 45,
      "lastCrawlStatus": "success",
      "errorCount": 0,
      "totalCrawled": 523
    },
    ...
  ],
  "recentLogs": [
    {
      "id": 1234,
      "websiteId": 1,
      "status": "success",
      "itemsCount": 45,
      "startedAt": "2026-08-17T14:23:00Z",
      "durationMs": 23450
    },
    ...
  ]
}
```

#### 前端 Admin 页面（可选）

`/admin` 路由展示：
- 网站状态表格
- 最近爬取日志
- 数据质量仪表盘

---

## 实施计划

### 时间表

| 阶段 | 任务 | 工时 | 执行者 | 开始日期 | 完成日期 |
|------|------|------|--------|---------|---------|
| **第一阶段** | | **9.5h** | | | |
| 1.3 | 前端跳顶修复 | 0.5h | grok | Day 1 | Day 1 |
| 1.1 | 详情页爬取 | 4h | grok | Day 1 | Day 2 |
| 1.2 | AI 内容过滤 | 3h | grok | Day 2 | Day 2 |
| 1.4 | 定时任务 | 2h | grok | Day 3 | Day 3 |
| **第二阶段** | | **4h** | | | |
| 2.1 | LLM 辅助提取 | 4h | grok | Day 4 | Day 4 |
| **第三阶段** | | **5h** | | | |
| 3.1 | 质量监控 | 2h | grok | Day 5 | Day 5 |
| 3.2 | 健康面板 | 3h | grok | Day 5 | Day 6 |

**总工期**：6 个工作日（按每天 3 小时计算）

### 执行顺序

**立即修复（Day 1-3）**：
1. ✅ 任务 1.3 - 最快见效，0.5 小时
2. ✅ 任务 1.1 - 核心功能，4 小时
3. ✅ 任务 1.2 - 数据质量，3 小时
4. ✅ 任务 1.4 - 自动化，2 小时

**质量提升（Day 4）**：
5. 任务 2.1 - LLM 辅助，4 小时

**后续优化（Day 5-6）**：
6. 任务 3.1 - 质量监控，2 小时
7. 任务 3.2 - 健康面板，3 小时

---

## 成本分析

### 开发成本

| 资源 | 单价 | 数量 | 小计 |
|------|------|------|------|
| grok-4.5 API 调用 | $0 | - | $0（使用本地 CLI）|
| 开发时间 | - | 18.5h | - |

### 运营成本（月）

| 服务 | 免费额度 | 预计用量 | 超额成本 |
|------|---------|---------|---------|
| Cloudflare Workers | 10 万次/天 | ~1000 次/天 | $0 |
| D1 数据库 | 5GB | < 100MB | $0 |
| Workers AI | 10,000 neurons/天 | ~250 次/天 | $0 |
| Pages | 无限 | - | $0 |
| **合计** | | | **$0/月** |

### 外部服务（可选）

| 服务 | 用途 | 月成本 |
|------|------|--------|
| VPS（Hetzner CPX11） | 重度爬虫 | €4.51 |
| GitHub Actions | 定时触发 | $0（2000 分钟/月）|

**推荐**：第一阶段使用 GitHub Actions（$0），用户增长后升级 VPS（€4.51/月）

---

## 风险管理

### 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Workers CPU 超时 | 🟡 中 | 定时任务失败 | 使用 GitHub Actions 触发 |
| 详情页反爬 | 🟡 中 | 部分网站爬取失败 | 增加 User-Agent 池，降低频率 |
| LLM 返回格式错误 | 🟡 中 | 提取失败 | 添加格式校验和降级逻辑 |
| D1 写入速度慢 | 🟢 低 | 数据入库延迟 | 分批插入（20 条/批）|

### 业务风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 政府网站改版 | 🟡 中 | 选择器失效 | 定期检查 + 异常告警 |
| 数据合规问题 | 🟢 低 | 法律风险 | 公告属公开信息，标注来源 |
| AI 过滤误判 | 🟡 中 | 漏掉有效公告 | 白名单关键词优先 |

---

## 验收标准

### 第一阶段验收（核心功能）

**数据质量指标**：
- [ ] 核心字段提取成功率 > 30%
- [ ] 有效招考公告占比 > 80%
- [ ] 数据库 NULL 占比 < 70%

**用户体验指标**：
- [ ] 筛选器无跳顶问题
- [ ] 页面加载时间 < 2 秒

**系统稳定性指标**：
- [ ] 定时任务成功执行率 > 90%
- [ ] API 响应时间 < 500ms

### 第二阶段验收（质量提升）

**数据质量指标**：
- [ ] 核心字段提取成功率 > 70%
- [ ] 数据库 NULL 占比 < 30%

### 第三阶段验收（可观测性）

**监控指标**：
- [ ] 质量报告 API 可用
- [ ] 健康面板展示准确数据

---

## 后续讨论事项

### 产品功能

1. **用户通知系统**
   - 新公告邮件/微信推送
   - 按地区/科目订阅

2. **数据导出**
   - Excel 导出
   - API 开放接口

3. **移动端优化**
   - PWA 支持
   - 微信小程序

### 技术架构

1. **爬虫扩展**
   - 支持更多省份（当前 8 个 → 目标 31 个）
   - 支持市级人社局

2. **数据增强**
   - 历史数据归档
   - 数据分析报表

3. **性能优化**
   - CDN 加速
   - 数据缓存策略

---

## 附录

### A. 已知技术债务

1. ❌ `FINAL_DELIVERY.md` 与实际实现不符
2. ❌ `docs/crawler/crawler-design.md` 第 3 步未实现
3. ❌ `api/schema.sql` 路径错误（实际在 `database/`）
4. ⚠️ `crawlers/` 和 `api/src/` 爬虫逻辑重复
5. ⚠️ 无单元测试
6. ⚠️ 无 CI/CD

### B. 依赖工具版本

- Node.js: 18.x
- grok CLI: 最新版
- Cloudflare Workers: 2024-01-01 compat
- Next.js: 14.2.35

### C. 参考资料

- [Cloudflare Workers AI 文档](https://developers.cloudflare.com/workers-ai/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
- [Next.js App Router 文档](https://nextjs.org/docs/app)

---

**文档维护**：
- 每完成一个任务，更新状态
- 遇到新问题，补充到风险管理
- 验收标准未达标时，记录原因和改进措施

**审批流程**：
1. 技术总监审阅方案 ✅
2. 用户确认优先级和范围 ⏳
3. 开始执行第一阶段 ⏳
