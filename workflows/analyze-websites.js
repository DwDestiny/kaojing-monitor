export const meta = {
  name: 'analyze-websites-structure',
  description: '批量分析招考网站的技术架构和爬虫可行性',
  phases: [
    { title: '获取网站列表', detail: '从数据库脚本解析 priority 1-2 的网站' },
    { title: '并行分析', detail: '每个网站独立分析：SSR/CSR、HTML结构、API检测' },
    { title: '生成报告', detail: '汇总可行性分析和 selector 配置建议' }
  ]
};

// 从 SQL 文件中提取网站列表（priority 1-2 的高优先级网站）
const sqlPath = '/Users/dw/Desktop/张晗/粉笔/考情监测/database/init-websites.sql';
const sqlContent = await $`cat ${sqlPath}`;

// 解析 SQL 提取网站信息
const websites = [];
const insertRegex = /INSERT INTO source_websites.*?VALUES \('([^']+)', '([^']+)', '([^']+)', '([^']+)', (\d+),/g;
let match;

while ((match = insertRegex.exec(sqlContent)) !== null) {
  const [, name, url, region, type, priority] = match;
  const priorityNum = parseInt(priority);

  // 只分析 priority 1-2 的网站（高优先级 + 已验证的）
  if (priorityNum <= 2) {
    websites.push({ name, url, region, type, priority: priorityNum });
  }
}

log(`找到 ${websites.length} 个高优先级网站待分析`);

// Phase 1: 并行分析每个网站
phase('并行分析');

const analysisSchema = {
  type: 'object',
  required: ['url', 'renderType', 'feasibility', 'listPageUrl', 'htmlStructure', 'hasApi', 'recommendation'],
  properties: {
    url: { type: 'string', description: '网站 URL' },
    renderType: {
      type: 'string',
      enum: ['SSR', 'CSR', 'HYBRID', 'UNKNOWN'],
      description: 'SSR=服务端渲染可直接爬, CSR=需要浏览器, HYBRID=混合'
    },
    feasibility: {
      type: 'string',
      enum: ['HIGH', 'MEDIUM', 'LOW', 'BLOCKED'],
      description: 'HIGH=可直接爬, MEDIUM=需要额外处理, LOW=困难, BLOCKED=无法访问'
    },
    listPageUrl: {
      type: 'string',
      description: '招考公告列表页的实际 URL（如果能找到）'
    },
    htmlStructure: {
      type: 'object',
      description: '列表页的 HTML 结构分析',
      properties: {
        containerSelector: { type: 'string', description: '列表容器选择器，如 .news-list, #announcement' },
        itemSelector: { type: 'string', description: '单条公告选择器，如 li, .item' },
        titleSelector: { type: 'string', description: '标题选择器，如 a, .title' },
        urlSelector: { type: 'string', description: 'URL 选择器，如 a@href' },
        dateSelector: { type: 'string', description: '日期选择器，如 .date, span.time' }
      }
    },
    hasApi: {
      type: 'boolean',
      description: '是否发现可用的 API 接口'
    },
    apiDetails: {
      type: 'string',
      description: '如果有 API，描述接口 URL 和请求方式'
    },
    recommendation: {
      type: 'string',
      enum: ['CHEERIO', 'PUPPETEER', 'API', 'SKIP'],
      description: 'CHEERIO=用HTML解析, PUPPETEER=需浏览器, API=调接口, SKIP=暂时跳过'
    },
    notes: {
      type: 'string',
      description: '其他注意事项：编码问题、反爬、登录要求等'
    }
  }
};

const results = await pipeline(
  websites,

  // Stage 1: 分析每个网站
  async (site) => {
    const prompt = `分析这个招考网站的爬虫可行性：

**网站信息**：
- 名称：${site.name}
- URL：${site.url}
- 地区：${site.region}
- 类型：${site.type}

**任务**：
1. 访问网站首页，寻找"招考公告"、"事业单位招聘"、"考试信息"等栏目
2. 进入列表页，分析页面渲染方式（查看网页源代码判断是 SSR 还是 CSR）
3. 如果是 SSR，分析 HTML 结构，提取列表容器、标题、链接、日期的选择器
4. 检查浏览器 Network 面板，看是否有 API 接口（JSON 响应）
5. 检查是否有反爬机制、登录要求、验证码等

**输出要求**：
- 如果网站无法访问或无招考信息，feasibility = BLOCKED，其他字段尽量填写
- 如果找不到列表页，listPageUrl 填空字符串
- htmlStructure 尽量完整，这是后续配置 selector 的依据
- notes 要详细记录特殊情况

**参考示例**（新疆兵团人事考试院）：
- renderType: SSR
- feasibility: HIGH
- listPageUrl: http://btpta.xjbt.gov.cn/tzgg/
- htmlStructure:
  - containerSelector: "div.con ul"
  - itemSelector: "li"
  - titleSelector: "a@title"
  - urlSelector: "a@href"
  - dateSelector: "span.fr"
- recommendation: CHEERIO`;

    return await agent(prompt, {
      schema: analysisSchema,
      label: site.name,
      phase: '并行分析',
      model: 'haiku'  // 用 Haiku 做探查，便宜快速
    });
  }
);

// 过滤掉失败的任务
const validResults = results.filter(Boolean);

log(`分析完成：${validResults.length}/${websites.length} 个网站成功`);

// Phase 2: 生成分析报告
phase('生成报告');

const reportPrompt = `根据以下 ${validResults.length} 个网站的分析结果，生成一份综合报告：

**数据**：
${JSON.stringify(validResults, null, 2)}

**报告要求**：

## 一、技术方案可行性总结
- 统计各 renderType 的数量（SSR/CSR/HYBRID）
- 统计各 feasibility 的数量（HIGH/MEDIUM/LOW/BLOCKED）
- 统计各 recommendation 的数量（CHEERIO/PUPPETEER/API/SKIP）

## 二、爬虫策略分类
### 方案 A：HTML 解析（CHEERIO）
列出所有 recommendation = CHEERIO 的网站，说明为什么适合

### 方案 B：浏览器自动化（PUPPETEER）
列出所有 recommendation = PUPPETEER 的网站，说明为什么需要

### 方案 C：API 调用
列出所有 recommendation = API 的网站，说明接口情况

### 方案 D：暂时跳过
列出所有 recommendation = SKIP 的网站，说明原因

## 三、自动化部署建议
基于分析结果，给出爬虫的部署方案：
1. **Cloudflare Workers** 能否覆盖大部分网站？
2. 哪些网站必须用独立服务器（需要 Puppeteer）？
3. 定时任务的频率建议（每小时/每天）
4. 成本估算

## 四、下一步行动清单
1. 优先接入哪 5-10 个网站（根据 feasibility 和重要性）
2. 需要编写的 selector 配置文件
3. 需要处理的特殊情况（反爬、登录等）

输出格式：Markdown`;

const report = await agent(reportPrompt, {
  label: '生成综合报告',
  phase: '生成报告'
});

// 保存报告和原始数据
const timestamp = new Date().toISOString().slice(0, 10);
const reportPath = `/Users/dw/Desktop/张晗/粉笔/考情监测/docs/crawler/website-analysis-${timestamp}.md`;
const dataPath = `/Users/dw/Desktop/张晗/粉笔/考情监测/docs/crawler/website-analysis-${timestamp}.json`;

await $`echo ${report} > ${reportPath}`;
await $`echo ${JSON.stringify(validResults, null, 2)} > ${dataPath}`;

log(`报告已保存：${reportPath}`);
log(`原始数据：${dataPath}`);

return {
  summary: `分析了 ${validResults.length} 个网站，报告已生成`,
  reportPath,
  dataPath
};
