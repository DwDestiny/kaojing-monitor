# 考情监测系统 - 问题清单与优化方案

生成时间：2026-08-17 22:30  
状态：待处理

---

## 核心问题总览

| 编号 | 问题 | 严重级别 | 影响范围 | 预计工时 | GitHub Issue |
|------|------|---------|---------|---------|--------------|
| #1 | 详情页未爬取，核心字段全 NULL | 🔴 P0 致命 | 数据质量 | 4h | [#1](https://github.com/DwDestiny/kaojing-monitor/issues/1) |
| #2 | 数据混入非招考公告（证书、公示等） | 🔴 P0 致命 | 数据质量 | 3h | [#2](https://github.com/DwDestiny/kaojing-monitor/issues/2) |
| #3 | 前端筛选器触发页面跳顶 | 🟠 P1 严重 | 用户体验 | 0.5h | [#3](https://github.com/DwDestiny/kaojing-monitor/issues/3) |
| #4 | 定时任务未实现，数据不更新 | 🟠 P1 严重 | 核心功能 | 2h | [#4](https://github.com/DwDestiny/kaojing-monitor/issues/4) |
| #5 | 科目字段为 NULL，无法筛选 | 🟠 P1 严重 | 功能完整性 | 含在 #1 | - |
| #6 | 原文链接无法访问或内容不完整 | 🟡 P2 中等 | 用户体验 | 含在 #1 | - |
| #7 | 正则提取准确率低，需 LLM 辅助 | 🟡 P2 中等 | 数据质量 | 4h | [#5](https://github.com/DwDestiny/kaojing-monitor/issues/5) |
| #8 | 无数据质量监控与异常告警 | 🟢 P3 优化 | 可维护性 | 2h | [#6](https://github.com/DwDestiny/kaojing-monitor/issues/6) |
| #9 | 缺少爬虫健康状态面板 | 🟢 P3 优化 | 可观测性 | 3h | [#7](https://github.com/DwDestiny/kaojing-monitor/issues/7) |

---

## 问题详细分析

### #1 详情页未爬取，核心字段全 NULL 🔴

**现象**：
- 线上 1424 条数据，关键字段全是 `null`：
  - `recruit_count`（招聘人数）
  - `exam_date`（考试日期）
  - `exam_subjects`（考试科目）
  - `exam_time`、`registration_deadline`、`salary_range`

**根因**：
- `crawlers/core/engine.js` 只爬了列表页，返回的 `rawHtml` 是列表项 `<li>` 的 HTML 片段
- 没有实现"爬取详情页"功能
- `crawlers/core/extractor.js` 的正则提取逻辑依赖详情页完整正文，但数据源不存在

**影响**：
- 用户看到的只有标题和链接，核心招考信息缺失
- 科目筛选功能完全失效（`exam_subjects` 为 NULL）
- 产品核心价值未实现（"自动提取招考信息"）

**技术债务**：
- 设计文档 `docs/crawler/crawler-design.md` 第 3 步明确写了"爬取详情页并提取"，但未实施
- `FINAL_DELIVERY.md` 声称"爬虫 100% 完成"与实际不符

---

### #2 数据混入非招考公告 🔴

**现象**：
- 实际数据样本：
  - "证书发放通知" ❌
  - "高校毕业生的档案攻略" ❌
  - "拟聘用人员公示" ❌（这是结果公示，不是招考公告）
  - "人选公示名单" ❌
  - 真正的招考公告占比可能不到 50%

**根因**：
- 爬虫无脑抓取政府人社厅网站的"通知公告"栏目全部内容
- 没有内容过滤机制

**影响**：
- 用户体验极差（翻半天找不到真正的招考信息）
- 统计数据失真（1424 条中可能只有 600-700 条有效）
- 存储和带宽浪费

**用户原话**：
> "你爬下来的东西很明显不是咱们要的，不是说咱们只要那些考勤信息、考试信息，不要别的"

---

### #3 前端筛选器触发页面跳顶 🟠

**现象**：
- 用户点击筛选器（地区/考试类型/科目）
- 页面刷新并滚动到页面顶部（Hero 区域）
- 列表区域在视口下方，用户需要再次滚动才能看到结果

**根因**：
- `Filter.tsx` 使用 `<Link href="...">` 触发路由跳转
- Next.js App Router 默认 `scroll: true`
- 筛选器没有指定滚动行为

**影响**：
- 用户每次筛选后都要手动滚动找列表
- 连续筛选操作体验割裂

**用户原话**：
> "我点选择旁边的分类，它页面就会刷新到最顶端，这个就很难受了。它应该刷新到列表的最顶端，而不是整个页面的最顶端"

---

### #4 定时任务未实现 🟠

**现象**：
- `api/wrangler.toml` 配置了 Cron：`["7 2 * * *", "23 14 * * *"]`（每天 2:07 和 14:23）
- `api/src/index.js` 第 46 行 `scheduled()` 函数只有一行 `console.log` 和 TODO 注释
- 定时任务从未运行过实际爬取

**根因**：
- 初始化时规划了定时任务，但从未实现
- 现有的 1424 条数据全部来自手动运行 `crawlers/process.js`

**影响**：
- 数据永远停留在 2026-08-17 的状态，不会自动更新
- 产品核心卖点"自动化监测"未实现

---

### #5 科目字段为 NULL，无法筛选 🟠

**现象**：
- API 返回的 `exam_subjects` 字段全是 `null`
- 前端科目筛选器显示空白或无效

**根因**：
- 等同于 #1，详情页未爬取导致提取失败

**影响**：
- 科目筛选功能完全不可用
- 用户无法按"行测"、"申论"等科目过滤

---

### #6 原文链接无法访问或内容不完整 🟡

**现象**：
- 部分公告 URL 格式异常（URL 被截断或编码错误）
- 点击"查看原文"可能跳转失败

**根因**：
- 列表页提取 URL 时，部分网站使用相对路径
- `resolveUrl()` 可能处理不当
- 未验证 URL 有效性

**影响**：
- 用户无法查看公告详情
- 信任度下降

---

### #7 正则提取准确率低 🟡

**现象**：
- 即使爬取到详情页，正则匹配也会遗漏部分字段
- 不同政府网站 HTML 结构差异大
- 表格形式的招考信息无法提取

**根因**：
- `crawlers/core/extractor.js` 只用正则匹配纯文本
- 无法处理非结构化或表格化内容

**改进方向**：
- 接入 Cloudflare Workers AI（免费额度 10,000 neurons/day）
- 正则优先，失败时调用 LLM 补充

**用户原话**：
> "有的信息不是格式化的页面，可能没法直接通过爬虫脚本提取出来，那就通过大模型提取"

---

### #8 无数据质量监控 🟢

**现象**：
- 不知道哪些网站爬取失败
- 不知道提取成功率
- NULL 字段占比无统计

**改进方向**：
- 每次爬取后生成质量报告
- 统计：成功/失败网站、字段完整率、NULL 占比
- 异常时通知（邮件/Webhook）

---

### #9 缺少爬虫健康状态面板 🟢

**现象**：
- 无法查看最近一次爬取时间
- 无法查看各网站爬取状态
- 无法手动触发爬取

**改进方向**：
- 新增 `/api/crawl-status` 接口
- 前端新增 Admin 页面（可选）
- 读取 `crawl_logs` 表展示状态

---

## 优化方案（分阶段实施）

### 第一阶段：核心功能修复（P0 + P1）

预计总工时：9.5 小时  
目标：让产品"能用"

#### 任务 1.1：实现详情页爬取 [4h]

**文件修改**：
- `crawlers/core/engine.js`
- `crawlers/process.js`

**实现逻辑**：
```javascript
// 在 process.js 的步骤 1 和 2 之间插入
const rawData = await crawl(siteConfig, options);         // 步骤 1：爬列表页
const withDetails = await fetchAllDetails(rawData, env);  // 新增：爬详情页
const extracted = batchExtract(withDetails);              // 步骤 2：提取字段
```

**新增函数**：
```javascript
async function fetchAllDetails(announcements, env) {
  const results = [];
  
  for (const item of announcements) {
    try {
      const html = await fetch(item.url).then(r => r.text());
      const $ = cheerio.load(html);
      
      // 提取正文（通用选择器：article、.content、.detail 等）
      const content = extractContent($);
      
      results.push({
        ...item,
        rawHtml: content  // 替换列表项 HTML 为完整正文
      });
      
      await sleep(randomDelay(1000, 2000));  // 礼貌爬取
    } catch (err) {
      console.error(`详情页爬取失败: ${item.url}`, err.message);
      results.push(item);  // 保留原数据
    }
  }
  
  return results;
}
```

**验收标准**：
- 数据库中 `rawHtml` 字段包含详情页完整 HTML
- `recruit_count`、`exam_date`、`exam_subjects` 至少 30% 条目非 NULL

---

#### 任务 1.2：接入 Cloudflare Workers AI 做内容过滤 [3h]

**目标**：只保留招考/招聘公告，过滤掉证书通知、档案攻略、公示名单等

**实现位置**：`crawlers/core/filter.js`（新建）

**API 调用**：
```javascript
import { Ai } from '@cloudflare/ai';

async function isRecruitmentAnnouncement(title, env) {
  const ai = new Ai(env.AI);
  
  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: '你是招考公告分类器。判断标题是否为招聘/招考公告（事业单位、公务员、教师、医疗等）。只回复 YES 或 NO。'
      },
      {
        role: 'user',
        content: `标题：${title}`
      }
    ]
  });
  
  return response.response.trim().toUpperCase() === 'YES';
}

export async function filterAnnouncements(announcements, env) {
  const results = [];
  
  for (const item of announcements) {
    const isValid = await isRecruitmentAnnouncement(item.title, env);
    if (isValid) {
      results.push(item);
    } else {
      console.log(`过滤: ${item.title}`);
    }
  }
  
  return results;
}
```

**流程插入**：
```javascript
// process.js
const rawData = await crawl(siteConfig, options);
const filtered = await filterAnnouncements(rawData, env);  // 新增：AI 过滤
const withDetails = await fetchAllDetails(filtered, env);
const extracted = batchExtract(withDetails);
```

**成本控制**：
- 免费额度：10,000 neurons/day ≈ 1000 次调用
- 每天爬取 200 条 → 筛掉 100 条垃圾 → 保存 100 条有效数据
- 月成本：$0

**验收标准**：
- 数据库中不再出现"证书发放"、"档案攻略"、"公示名单"
- 有效招考公告占比 > 80%

---

#### 任务 1.3：修复前端筛选器跳顶问题 [0.5h]

**文件修改**：`frontend/components/Filter.tsx`

**方案**：滚动到列表顶部而不是页面顶部

```typescript
// Filter.tsx 修改 FilterLink 组件
function FilterLink({ href, label, count, active }: FilterLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    // 不阻止默认行为，让 Next.js 路由正常工作
    // 但在导航完成后滚动到列表
    setTimeout(() => {
      const listElement = document.getElementById('announcements');
      if (listElement) {
        const offset = 80; // 顶部导航栏高度
        const top = listElement.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <li className="mb-space-1">
      <Link
        href={href}
        onClick={handleClick}
        className={...}
      >
        ...
      </Link>
    </li>
  );
}
```

**更优雅方案**（如果 Link 支持）：
```typescript
<Link 
  href={href} 
  scroll={false}  // 禁用自动滚动
  ...
>
```

然后在 `HomeClient.tsx` 的 `useEffect` 中：
```typescript
useEffect(() => {
  // 数据加载完成后滚动到列表
  if (!loading && announcements.length > 0) {
    const listElement = document.getElementById('announcements');
    if (listElement && window.scrollY > listElement.offsetTop) {
      listElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}, [loading, announcements]);
```

**验收标准**：
- 点击任意筛选器，页面停留在列表顶部
- 滚动行为流畅

---

#### 任务 1.4：实现 Workers Cron 定时爬取 [2h]

**文件修改**：`api/src/index.js`

**实现逻辑**：
```javascript
async scheduled(event, env, ctx) {
  console.log('Cron triggered:', event.cron);
  
  // 从 D1 读取启用的网站配置
  const sites = await env.DB.prepare(
    'SELECT * FROM source_websites WHERE status = ? LIMIT 5'
  ).bind('active').all();
  
  // 逐个爬取（Workers CPU 限制，一次只爬少量）
  for (const site of sites.results) {
    try {
      const config = JSON.parse(site.selector_config);
      
      // 调用爬虫（需要将 crawlers/core/engine.js 移植到 Workers）
      const data = await crawlSite(config);
      
      // 过滤 + 提取
      const filtered = await filterWithAI(data, env);
      const extracted = extractFields(filtered);
      
      // 存入 D1
      for (const item of extracted) {
        await saveAnnouncement(item, env);
      }
      
      // 记录日志
      await logCrawl(site.id, 'success', data.length, env);
      
    } catch (err) {
      await logCrawl(site.id, 'failed', 0, env, err.message);
    }
  }
}
```

**问题**：
- Cloudflare Workers CPU 时间限制（免费版 10ms，付费版 50ms）
- 爬取 5 个网站可能超时

**解决方案**：
- 每次 Cron 只爬 2-3 个网站
- 使用 `source_websites.priority` 字段轮询
- 或拆成多个 Worker，每个负责几个网站

**验收标准**：
- 每天 2:07 和 14:23 自动爬取
- `crawl_logs` 表有记录
- 新数据进入 `announcements` 表

---

### 第二阶段：数据质量提升（P2）

预计总工时：4 小时

#### 任务 2.1：LLM 辅助字段提取 [4h]

**触发条件**：正则提取失败（字段为 NULL）

```javascript
async function extractWithAI(content, env) {
  const ai = new Ai(env.AI);
  
  const prompt = `
从以下招考公告中提取信息，以 JSON 格式输出：
{
  "recruitCount": 数字或null,
  "examDate": "YYYY-MM-DD"或null,
  "examSubjects": ["科目1", "科目2"]或[],
  "examTime": "HH:MM-HH:MM"或null
}

公告内容：
${content.slice(0, 2000)}  // 限制长度避免超额
`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: '你是招考信息提取专家。' },
      { role: 'user', content: prompt }
    ]
  });
  
  return JSON.parse(response.response);
}
```

**成本**：
- 每条公告 1 次调用
- 每天新增 100 条 × 30% 正则失败率 = 30 次 LLM 调用
- 月成本：$0（免费额度内）

---

### 第三阶段：可观测性与维护性（P3）

预计总工时：5 小时

#### 任务 3.1：数据质量监控 [2h]
- 新增 `/api/quality-report` 接口
- 统计字段完整率、NULL 占比、异常数据
- 每日生成质量报告

#### 任务 3.2：爬虫健康面板 [3h]
- 新增 `/api/crawl-status` 接口
- 前端新增 `/admin` 页面（可选）
- 展示最近爬取时间、成功率、失败日志

---

## 实施优先级建议

### 立即修复（本轮迭代）
1. ✅ 任务 1.3：前端跳顶问题（0.5h）— 最快见效
2. ✅ 任务 1.1：详情页爬取（4h）— 核心功能
3. ✅ 任务 1.2：AI 内容过滤（3h）— 数据质量

### 下一轮迭代
4. 任务 1.4：定时爬取（2h）
5. 任务 2.1：LLM 辅助提取（4h）

### 后续优化
6. 任务 3.1、3.2：监控与面板（5h）

---

## 成本估算

### Cloudflare Workers AI 用量
| 场景 | 日调用量 | 月调用量 | 免费额度 | 超额成本 |
|------|---------|---------|---------|---------|
| 内容过滤 | 200 | 6,000 | 10,000 | $0 |
| LLM 提取 | 30 | 900 | 包含在上面 | $0 |
| **合计** | 230 | 6,900 | 10,000 | **$0/月** |

### 总体成本
- Workers：免费（10 万次/天）
- D1：免费（5GB）
- Pages：免费
- Workers AI：免费（10,000 neurons/day）
- **月成本：$0**

---

## 风险与限制

### 技术限制
1. **Workers CPU 时间限制**：每次 Cron 只能爬 2-3 个网站
2. **D1 读写速度**：批量插入需分批
3. **AI 调用延迟**：每条 200-500ms，需异步处理

### 反爬风险
1. **IP 封禁**：Workers 出口 IP 可能被政府网站识别
2. **频率限制**：需要 `sleep()` 控制间隔
3. **JS 渲染页面**：部分网站需要 Puppeteer（Workers 不支持）

### 数据合规
1. **版权问题**：公告内容属政府公开信息，合法
2. **robots.txt**：需检查各网站爬取许可
3. **用户隐私**：不涉及个人信息

---

## 后续讨论事项

1. **是否需要网站管理后台？**
   - 手动添加新网站
   - 查看爬取日志
   - 手动触发爬取

2. **是否需要用户反馈功能？**
   - "数据错误"反馈
   - "新增网站"请求
   - 已在 Schema 中有 `user_feedback` 表

3. **是否需要邮件/微信通知？**
   - 新公告推送
   - 爬取异常告警

4. **是否需要移动端优化？**
   - 当前响应式设计是否足够
   - 是否需要 PWA

---

## 附录：已知技术债务

1. ❌ `FINAL_DELIVERY.md` 声称"爬虫 100% 完成"但 `scheduled()` 为空
2. ❌ `docs/crawler/crawler-design.md` 第 3 步"详情页爬取"未实现
3. ❌ `api/schema.sql` 不存在，实际文件是 `database/schema-d1.sql`
4. ⚠️ `crawlers/` 和 `api/src/` 爬虫逻辑重复，需统一
5. ⚠️ 无单元测试
6. ⚠️ 无 CI/CD 自动化测试

---

**文档维护**：本文件需与 GitHub Issues 同步更新。创建 issue 后在此标注 issue 编号。
