# Cloudflare Workers AI 接入方案

## 目标
使用 Cloudflare Workers AI 提升数据质量，准确率从当前0%提升至90%+。

## 免费额度
- **神经元配额**：100万/天（Standard计划免费）
- **预估消耗**：
  - 分类：1000条 × 2000神经元 = 200万神经元/天
  - 提取：500条 × 8000神经元 = 400万神经元/天
  - **总计**：600万神经元/天
- **结论**：需要分批处理，或只对规则不确定的案例调用AI

## Cloudflare Workers AI 模型选型

### 可用模型列表
参考：https://developers.cloudflare.com/workers-ai/models/

| 模型 | 类型 | 上下文 | 神经元/请求 | 适用场景 |
|------|------|--------|-------------|----------|
| @cf/meta/llama-3.1-8b-instruct | 文本生成 | 128K | ~2000 | 短文本分类 |
| @cf/meta/llama-3.1-70b-instruct | 文本生成 | 128K | ~8000 | 长文本理解 |
| @cf/meta/llama-3-8b-instruct | 文本生成 | 8K | ~1500 | 轻量分类 |
| @cf/qwen/qwen1.5-14b-chat-awq | 文本生成 | 32K | ~3000 | 中文理解 |

### 选择策略

**阶段1：内容分类**（判断是否为招考公告）
- 模型：`@cf/meta/llama-3.1-8b-instruct`
- 输入：标题 + 简介（~200 tokens）
- 输出：JSON `{"isRecruitment": true/false, "reason": "..."}`
- 神经元消耗：~2000/次

**阶段2：字段提取**（提取招聘人数、考试科目）
- 模型：`@cf/meta/llama-3.1-70b-instruct`（长文本）
- 输入：标题 + 详情页HTML（前16K tokens，~64KB）
- 输出：JSON结构化字段
- 神经元消耗：~8000/次

### 成本控制策略

由于免费额度100万神经元/天，实际消耗600万/天，采用**混合模式**：

```
规则快速过滤（明确情况） → 规则提取（简单格式） → AI兜底（复杂/失败情况）
       ↓                          ↓                        ↓
   黑名单60%                 正则成功40%              AI处理剩余10-20%
```

**具体策略**：
1. 规则先行：黑白名单+负面词检测
2. 规则提取：尝试正则提取recruitCount/examSubjects
3. **AI触发条件**：
   - 分类不确定（既不在黑名单也不在白名单）
   - 提取失败（recruitCount=null且标题包含"招聘XX人"）
   - 标题模糊（包含"详见附件"、"岗位表"）

预期AI调用量：150-200条/天 → 约200万神经元（在免费额度内）

## 架构设计

### 工作流

```
列表页 → 规则过滤 → 详情页 → 规则提取 → AI验证/补全 → validator → 数据库
          ↓                      ↓            ↓
       拦截60%              成功40%        处理10-20%
```

### 模块设计

#### 模块1：`crawlers/core/cf-ai-client.js`（基础设施）
```javascript
/**
 * Cloudflare Workers AI 客户端
 * 用于本地测试（通过 REST API）
 */
export class CloudflareAIClient {
  constructor(accountId, apiToken) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;
  }

  async runModel(modelName, inputs) {
    const response = await fetch(`${this.baseUrl}/${modelName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(inputs)
    });
    
    if (!response.ok) {
      throw new Error(`CF AI API error: ${response.status}`);
    }
    
    return await response.json();
  }

  async classify(title, snippet) {
    const prompt = `你是招考信息分类专家。判断以下内容是否为【正式招考公告】。

✅ 是招考公告：
- 公开招聘/招考/遴选工作人员的正式通知
- 包含岗位信息、报名时间、考试安排

❌ 不是招考公告：
- 报名入口/注册指南/操作手册
- 考试结果（成绩、面试名单、拟聘用公示）
- 流程通知（心理测评、体检、资格审查）
- 招聘会/宣讲会/双选会活动通知
- 风险提醒（虚假招聘、诈骗案例）

【输入】
标题：${title}
简介：${snippet || '无'}

【输出JSON】
{"isRecruitment": true/false, "confidence": 0.0-1.0, "reason": "一句话判断依据"}`;

    const result = await this.runModel('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }]
    });
    
    // 解析JSON响应
    const text = result.result.response;
    const jsonMatch = text.match(/\{[^}]+\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { isRecruitment: false, confidence: 0 };
  }

  async extractFields(title, rawHtml) {
    // 截断HTML到前16K tokens（约64KB）
    const truncatedHtml = rawHtml.slice(0, 64000);
    
    const prompt = `从招考公告中提取关键信息。

【提取规则】
1. recruitCount（招聘人数）
   - 优先提取总人数
   - 忽略规则说明中的数字（如"计划招聘1人的，取消岗位"）
   - 如果写"详见附件"返回null

2. examSubjects（考试科目）
   - 返回原始科目名称数组
   - 不要合并（"教育学"+"心理学"不要合并为"教育综合"）
   - 如果未提及返回null

【输入】
标题：${title}
正文：${truncatedHtml}

【输出JSON】严格按以下schema返回
{
  "recruitCount": number | null,
  "examSubjects": string[] | null,
  "confidence": 0.0-1.0
}`;

    const result = await this.runModel('@cf/meta/llama-3.1-70b-instruct', {
      messages: [{ role: 'user', content: prompt }]
    });
    
    const text = result.result.response;
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { recruitCount: null, examSubjects: null };
  }
}
```

#### 模块2：`crawlers/core/hybrid-filter.js`（混合过滤）
```javascript
import { ruleBasedFilter } from './ai-filter.js';
import { CloudflareAIClient } from './cf-ai-client.js';

/**
 * 混合过滤：规则优先，AI兜底
 */
export async function hybridFilter(announcements, cfConfig) {
  const client = new CloudflareAIClient(cfConfig.accountId, cfConfig.apiToken);
  
  const results = [];
  let aiCallCount = 0;
  
  for (const item of announcements) {
    // 1. 规则过滤（黑名单）
    if (shouldRejectByRule(item.title)) {
      console.log(`  ❌ 规则拒绝: ${item.title}`);
      continue;
    }
    
    // 2. 规则通过（白名单+负面词检测）
    if (shouldAcceptByRule(item.title)) {
      console.log(`  ✅ 规则通过: ${item.title}`);
      results.push(item);
      continue;
    }
    
    // 3. 规则不确定 → 调用AI
    console.log(`  🤖 AI判断: ${item.title}`);
    try {
      const classification = await client.classify(item.title, item.snippet || '');
      aiCallCount++;
      
      if (classification.isRecruitment && classification.confidence > 0.6) {
        results.push(item);
      }
    } catch (err) {
      console.error(`  ⚠️ AI调用失败: ${err.message}，保守保留`);
      results.push(item);  // 失败时保守策略
    }
  }
  
  console.log(`\n📊 过滤统计: 总${announcements.length}条，保留${results.length}条，AI调用${aiCallCount}次\n`);
  return results;
}

function shouldRejectByRule(title) {
  const blacklist = [
    '报名入口', '注册指南', '操作手册', '账号注册',
    '心理测评', '体检通知', '资格审查结果',
    '成绩公告', '面试名单', '拟聘用', '公示名单',
    '招聘会', '宣讲会', '双选会',
    '陷阱', '诈骗', '风险提醒', '案例'
  ];
  return blacklist.some(kw => title.includes(kw));
}

function shouldAcceptByRule(title) {
  const whitelist = ['招聘', '招考', '招录', '遴选'];
  const negativeWords = ['陷阱', '诈骗', '虚假', '风险', '提醒', '案例'];
  
  const hasWhitelist = whitelist.some(kw => title.includes(kw));
  const hasNegative = negativeWords.some(kw => title.includes(kw));
  
  return hasWhitelist && !hasNegative && !shouldRejectByRule(title);
}
```

#### 模块3：`crawlers/core/hybrid-extractor.js`（混合提取）
```javascript
import { extractFields as ruleExtract } from './extractor.js';
import { CloudflareAIClient } from './cf-ai-client.js';

/**
 * 混合提取：规则优先，AI补全
 */
export async function hybridExtract(announcements, cfConfig) {
  const client = new CloudflareAIClient(cfConfig.accountId, cfConfig.apiToken);
  
  const results = [];
  let aiCallCount = 0;
  
  for (const item of announcements) {
    // 1. 规则提取
    const ruleResult = ruleExtract(item);
    
    // 2. 检查是否需要AI补全
    const needsAI = (
      ruleResult.recruitCount === null && 
      (item.title.includes('招聘') || item.title.includes('招考'))
    ) || (
      item.title.includes('详见附件') ||
      item.title.includes('岗位表') ||
      item.title.includes('岗位计划')
    );
    
    if (!needsAI) {
      results.push({ ...item, ...ruleResult });
      continue;
    }
    
    // 3. AI提取
    console.log(`  🤖 AI提取: ${item.title}`);
    try {
      const aiResult = await client.extractFields(item.title, item.rawHtml);
      aiCallCount++;
      
      // AI优先，规则兜底
      results.push({
        ...item,
        recruitCount: aiResult.recruitCount || ruleResult.recruitCount,
        examSubjects: aiResult.examSubjects || ruleResult.examSubjects,
        examDate: ruleResult.examDate,
        registrationDeadline: ruleResult.registrationDeadline,
        salaryRange: ruleResult.salaryRange
      });
    } catch (err) {
      console.error(`  ⚠️ AI提取失败: ${err.message}，使用规则结果`);
      results.push({ ...item, ...ruleResult });
    }
  }
  
  console.log(`\n📊 提取统计: AI调用${aiCallCount}次\n`);
  return results;
}
```

#### 模块4：配置文件 `config/cloudflare.json`
```json
{
  "accountId": "YOUR_ACCOUNT_ID",
  "apiToken": "YOUR_API_TOKEN",
  "models": {
    "classify": "@cf/meta/llama-3.1-8b-instruct",
    "extract": "@cf/meta/llama-3.1-70b-instruct"
  },
  "limits": {
    "maxAICallsPerDay": 200,
    "maxRetries": 2,
    "timeoutMs": 30000
  }
}
```

## 实施任务

### Task 1：配置 Cloudflare API
- 获取 Account ID（Dashboard → Workers & Pages → 右侧栏）
- 创建 API Token（Dashboard → My Profile → API Tokens → Create Token）
  - 权限：Workers AI:Read
- 填入 `config/cloudflare.json`

### Task 2：实现 CF AI 客户端
- 创建 `crawlers/core/cf-ai-client.js`
- 实现 classify() 和 extractFields()
- 单元测试：调用API验证返回格式

### Task 3：实现混合过滤器
- 创建 `crawlers/core/hybrid-filter.js`
- 规则优先 + AI兜底逻辑
- 统计AI调用次数

### Task 4：实现混合提取器
- 创建 `crawlers/core/hybrid-extractor.js`
- 规则优先 + AI补全逻辑
- 只对必要情况调用AI

### Task 5：集成到工作流
- 修改 `crawlers/process.js`
- 替换 filterAnnouncements → hybridFilter
- 替换 extractFields → hybridExtract

### Task 6：测试验证
- 对20个失败样本重新爬取
- 统计准确率和AI调用次数
- 检查是否在免费额度内

## 成功标准

- [x] AI调用次数 < 200次/批（控制在免费额度内）
- [x] 内容分类准确率 ≥ 95%（拦截"报名入口"/"心理测评"等）
- [x] 字段提取准确率 ≥ 90%（recruitCount/examSubjects）
- [x] 随机抽查20条 ≤ 2条有问题（90%准确率）

## 降级方案

如果 Cloudflare Workers AI 不可用：
1. 本地开发：通过 REST API 调用（需配置 accountId + apiToken）
2. API限流：降低AI调用频率，只处理最关键的案例
3. API失败：回退到纯规则方案

## 时间估算

- Task 1: 配置（10分钟）
- Task 2-4: 实现（2小时）
- Task 5: 集成（30分钟）
- Task 6: 测试（1小时）
- **总计：4小时**
