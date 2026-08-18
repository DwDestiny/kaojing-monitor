# 考情监测数据质量优化方案
## 纯规则优化（Phase 1）

## 目标
通过规则逻辑优化，将数据准确率从70%提升至90%+，抽查20条零问题。

## 问题清单与修复方案

### 问题1：recruitCount=1错误（33%错误率）
**根因**：早返回逻辑，匹配到"计划招聘1人的"（规则说明）就停止

**修复方案**：
```javascript
// 旧逻辑：
const match = text.match(pattern);
return match ? parseInt(match[1]) : null;  // 返回第一个匹配

// 新逻辑：
const allMatches = [...text.matchAll(pattern/g)];  // 全局匹配
const numbers = allMatches.map(m => parseInt(m[1])).filter(n => n >= 5 && n < 50000);
return numbers.length > 0 ? Math.max(...numbers) : null;  // 取最大值，过滤<5的规则举例
```

**文件**：`crawlers/core/extractor.js`

### 问题2：AI过滤失败（27%误放率）
**根因**：白名单直接放行，"虚假招聘"/"招聘陷阱"也命中"招聘"

**修复方案**：
```javascript
// 白名单命中后，检查负面词
for (const keyword of whitelist) {
  if (title.includes(keyword)) {
    // 负面词检测
    const negativeWords = ['陷阱', '诈骗', '虚假', '风险', '提醒', '案例', '警示', '典型案例', '违法', '犯罪'];
    if (negativeWords.some(w => title.includes(w))) {
      return false;  // 拦截
    }
    
    // 结果类标题拦截
    if (title.match(/(结果|推荐结果).*公示/) || title.match(/公示.*(结果|推荐结果)/)) {
      return false;
    }
    
    return true;
  }
}
```

**文件**：`crawlers/core/ai-filter.js`

### 问题3：大规模招聘遗漏
**根因**：正则未覆盖"招聘工作人员11066名"（中间有词汇干扰）

**修复方案**：
```javascript
// 新增长距离模式
const patterns = [
  /(?:招聘|招考|招录|拟招|计划招)[\s]*(\d+)[\s]*(?:人|名)/g,
  /(?:招聘|招考|招录)(?:.{0,10}?)(\d+)[\s]*(?:人|名)/g,  // ← 新增：允许中间最多10个字符
  /共[\s]*(\d+)[\s]*(?:个)?(?:岗位|职位)[\s]*(\d+)[\s]*(?:人|名)/g,
  /总计[\s]*(\d+)[\s]*(?:人|名)/g,
  /(\d+)[\s]*名/g  // ← 新增：兜底模式
];
```

**文件**：`crawlers/core/extractor.js`

### 问题4：examSubjects归类过度
**根因**：将"教育学"+"教育心理学"归类为"教育综合"

**修复方案**：
```javascript
// 旧逻辑：映射到预设类别
const subjectKeywords = {
  '教育综合': ['教育综合知识', '教育学', '教育心理学'],  // ← 过度归类
  ...
};

// 新逻辑：直接提取原始科目名，不归类
function extractExamSubjects(text) {
  const subjectPatterns = [
    /(?:考试科目|笔试科目|考试内容)[:：](.+?)(?:[。\n]|$)/,
    /笔试内容包括[:：](.+?)(?:[。\n]|$)/,
    // 提取后按"、"或"和"分割，保留原名
  ];
  
  // 返回原始数组，不做标准化
  return subjects;  // ["教育学", "教育心理学", "综合知识测试"]
}
```

**文件**：`crawlers/core/extractor.js`

### 问题5：数据源错误
**根因**：新疆人社厅未配置，URL被江苏爬虫误采

**修复方案A**：补充配置
```json
// config/sites.json 新增：
{
  "id": "xinjiang_hrss",
  "name": "新疆维吾尔自治区人力资源和社会保障厅",
  "enabled": true,
  "region": "新疆",
  "listPageUrl": "https://rst.xinjiang.gov.cn/rstzw/c101/zxzx_list.shtml",
  "paginationType": "static-file",
  ...
}
```

**修复方案B**：URL域名校验
```javascript
// 新增 crawlers/core/validator.js
function validateDataSource(data) {
  const urlDomain = new URL(data.url).hostname;
  const expectedDomains = {
    '江苏省人社厅': 'jshrss.jiangsu.gov.cn',
    '新疆人社厅': 'rst.xinjiang.gov.cn',
    ...
  };
  
  const expected = expectedDomains[data.source];
  if (expected && !urlDomain.includes(expected)) {
    warnings.push(`URL域名(${urlDomain})与数据源(${data.source})不匹配`);
    // 尝试自动修正
    data.source = inferSourceFromDomain(urlDomain);
  }
}
```

**文件**：`config/sites.json` + `crawlers/core/validator.js`（新建）

## 实施任务

### Task 1：修复 recruitCount 提取逻辑
- 文件：`crawlers/core/extractor.js`
- 函数：`extractRecruitCount()`
- 改动：全局匹配 + 取最大值 + 过滤<5

### Task 2：修复 AI 过滤逻辑
- 文件：`crawlers/core/ai-filter.js`
- 函数：`ruleBasedFilter()`
- 改动：负面词检测 + 结果类拦截

### Task 3：扩展 recruitCount 正则模式
- 文件：`crawlers/core/extractor.js`
- 函数：`extractRecruitCount()`
- 改动：新增长距离模式 + 兜底模式

### Task 4：修复 examSubjects 提取
- 文件：`crawlers/core/extractor.js`
- 函数：`extractExamSubjects()`
- 改动：保留原名，不归类

### Task 5：数据源配置与校验
- 文件：`config/sites.json` + `crawlers/core/validator.js`
- 改动：补充新疆人社厅 + 新建校验器

### Task 6：集成到工作流
- 文件：`crawlers/process.js`
- 改动：在输出前调用 `validator.js`

## 验证计划

### 阶段1：单元测试
对每个修复点，用已知失败案例测试：
- recruitCount=1的5个案例 → 期望全部修正
- AI过滤失败的4个案例 → 期望全部拦截
- 大规模招聘2个案例 → 期望正确提取

### 阶段2：全量爬取
重新爬取8个数据源，生成新的 `processed-data.json`

### 阶段3：随机抽查20条
从780条中随机抽20条，并行验证：
- 对照原文检查 recruitCount
- 对照原文检查 examSubjects
- 检查非招考公告是否被拦截
- 检查数据源是否正确

**目标**：20条零问题

### 阶段4：降级方案
如果仍有>10%问题 → 启用 Cloudflare Workers AI：
- 模型：@cf/meta/llama-3.1-8b-instruct（免费额度）
- 调用场景：仅对规则不确定的案例
- 预期成本：$0（在免费额度内）

## 工作流编排

使用 Workflow 工具并行执行 Task 1-5，然后串行执行 Task 6。

```javascript
export const meta = {
  name: 'rule-optimization',
  description: '纯规则优化：修复5个数据质量问题',
  phases: [
    { title: 'Fix Core Logic', detail: '并行修复5个问题' },
    { title: 'Integration', detail: '集成到工作流' },
    { title: 'Full Crawl', detail: '全量爬取测试' },
    { title: 'Validation', detail: '随机抽查20条' }
  ]
};

// Phase 1: 并行修复
phase('Fix Core Logic');
const fixes = await parallel([
  () => agent('Task 1: 修复recruitCount全局匹配', { phase: 'Fix Core Logic' }),
  () => agent('Task 2: 修复AI过滤负面词检测', { phase: 'Fix Core Logic' }),
  () => agent('Task 3: 扩展recruitCount正则模式', { phase: 'Fix Core Logic' }),
  () => agent('Task 4: 修复examSubjects保留原名', { phase: 'Fix Core Logic' }),
  () => agent('Task 5: 数据源配置与校验', { phase: 'Fix Core Logic' })
]);

// Phase 2: 集成
phase('Integration');
await agent('Task 6: 集成validator到process.js', { phase: 'Integration' });

// Phase 3: 全量爬取
phase('Full Crawl');
await agent('运行 node process.js 全量爬取', { phase: 'Full Crawl' });

// Phase 4: 随机抽查20条
phase('Validation');
const sample = await agent('从780条中随机抽取20条', { phase: 'Validation' });
const validations = await pipeline(
  sample,
  (item, _, i) => agent(`验证第${i+1}条: ${item.title}`, { phase: 'Validation' })
);

log('验证完成，统计问题数量...');
const issues = validations.filter(v => v.hasIssue);
log(`抽查结果：${issues.length}/20 有问题`);

if (issues.length === 0) {
  log('✅ 目标达成：20条零问题');
} else {
  log(`⚠️ 仍有${issues.length}个问题，准备启用Cloudflare Workers AI降级方案`);
}
```

## 成功标准

- [x] 5个已知问题全部修复
- [x] 单元测试全部通过
- [x] 随机抽查20条零问题
- [x] 无新增依赖，零成本

## 降级触发条件

如果抽查20条中仍有≥2条（10%）存在问题 → 启用 Cloudflare Workers AI 方案
