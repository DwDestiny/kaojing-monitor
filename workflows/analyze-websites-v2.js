export const meta = {
  name: 'analyze-websites-structure-v2',
  description: '批量分析招考网站的技术架构和爬虫可行性',
  phases: [
    { title: '准备网站列表', detail: '筛选高优先级网站' },
    { title: '并行分析', detail: '每个网站独立分析结构', model: 'haiku' },
    { title: '生成报告', detail: '汇总可行性分析' }
  ]
};

// 硬编码高优先级网站列表（priority 1-2）
const websites = [
  // 已验证可用
  { name: '新疆生产建设兵团人事考试院', url: 'http://btpta.xjbt.gov.cn', region: '新疆兵团', type: '人事考试网', priority: 2 },

  // Priority 1 - 直辖市
  { name: '北京市人力资源和社会保障局', url: 'https://rsj.beijing.gov.cn', region: '北京', type: '人社局', priority: 1 },
  { name: '北京市机关事务管理局事业单位公开招聘平台', url: 'https://zhaopin.jgj.beijing.gov.cn', region: '北京', type: '招聘平台', priority: 1 },
  { name: '上海市人力资源和社会保障局', url: 'https://hrss.sh.gov.cn', region: '上海', type: '人社局', priority: 1 },
  { name: '上海公务员考试网', url: 'https://apta.sh.gov.cn', region: '上海', type: '人事考试网', priority: 1 },
  { name: '天津市人力资源和社会保障局', url: 'https://hrss.tj.gov.cn', region: '天津', type: '人社局', priority: 1 },
  { name: '重庆市人力资源和社会保障局', url: 'https://rlsbj.cq.gov.cn', region: '重庆', type: '人社局', priority: 1 },

  // Priority 1 - 经济发达省份
  { name: '广东省人力资源和社会保障厅', url: 'https://hrss.gd.gov.cn', region: '广东', type: '人社局', priority: 1 },
  { name: '江苏省人力资源和社会保障厅', url: 'https://jshrss.jiangsu.gov.cn', region: '江苏', type: '人社局', priority: 1 },
  { name: '浙江省人力资源和社会保障厅', url: 'https://rlsbt.zj.gov.cn', region: '浙江', type: '人社局', priority: 1 },
  { name: '山东省人力资源和社会保障厅', url: 'https://hrss.shandong.gov.cn', region: '山东', type: '人社局', priority: 1 },
  { name: '福建省人力资源和社会保障厅', url: 'https://rst.fujian.gov.cn', region: '福建', type: '人社局', priority: 1 },
];

log(`准备分析 ${websites.length} 个高优先级网站`);

// Phase 1: 并行分析
phase('并行分析');

const analysisSchema = {
  type: 'object',
  required: ['url', 'renderType', 'feasibility', 'recommendation'],
  properties: {
    url: { type: 'string' },
    renderType: {
      type: 'string',
      enum: ['SSR', 'CSR', 'HYBRID', 'UNKNOWN'],
      description: 'SSR=服务端渲染, CSR=客户端渲染需JS, HYBRID=混合'
    },
    feasibility: {
      type: 'string',
      enum: ['HIGH', 'MEDIUM', 'LOW', 'BLOCKED'],
      description: 'HIGH=易爬, MEDIUM=中等难度, LOW=困难, BLOCKED=无法访问'
    },
    listPageUrl: {
      type: 'string',
      description: '找到的招考公告列表页URL，找不到填空'
    },
    containerSelector: {
      type: 'string',
      description: '列表容器CSS选择器，如 .news-list, div.con ul'
    },
    itemSelector: {
      type: 'string',
      description: '单条公告选择器，如 li, .item'
    },
    titleSelector: {
      type: 'string',
      description: '标题选择器，如 a@title, .title'
    },
    urlSelector: {
      type: 'string',
      description: 'URL选择器，如 a@href'
    },
    dateSelector: {
      type: 'string',
      description: '日期选择器，如 span.fr, .date'
    },
    hasApi: {
      type: 'boolean',
      description: '是否发现JSON API接口'
    },
    apiUrl: {
      type: 'string',
      description: '如果有API，记录接口URL'
    },
    recommendation: {
      type: 'string',
      enum: ['CHEERIO', 'PUPPETEER', 'API', 'SKIP'],
      description: 'CHEERIO=HTML解析, PUPPETEER=需浏览器, API=调接口, SKIP=跳过'
    },
    notes: {
      type: 'string',
      description: '特殊情况：反爬、登录、编码问题等'
    }
  }
};

const results = await pipeline(
  websites,

  async (site, _, index) => {
    const prompt = `分析招考网站 ${site.name} 的爬虫可行性。

**网站**: ${site.url}

**步骤**:
1. 用 curl 或浏览器访问首页
2. 找"招考公告"、"事业单位招聘"、"通知公告"等栏目
3. 进入列表页，查看源代码判断 SSR/CSR
4. 如果是 SSR，分析 HTML 结构提取选择器
5. 检查 Network 是否有 JSON API
6. 判断可行性和推荐方案

**参考示例** (新疆兵团):
- renderType: SSR
- feasibility: HIGH
- listPageUrl: http://btpta.xjbt.gov.cn/tzgg/
- containerSelector: div.con ul
- itemSelector: li
- titleSelector: a@title
- urlSelector: a@href
- dateSelector: span.fr
- hasApi: false
- recommendation: CHEERIO

如果无法访问或找不到列表页，feasibility=BLOCKED 或 LOW，其他字段尽量填写。`;

    return await agent(prompt, {
      schema: analysisSchema,
      label: `[${index + 1}/${websites.length}] ${site.name}`,
      phase: '并行分析',
      model: 'haiku'
    });
  }
);

const validResults = results.filter(Boolean);

log(`分析完成: ${validResults.length}/${websites.length} 成功`);

// Phase 2: 生成报告
phase('生成报告');

const reportPrompt = `基于 ${validResults.length} 个网站的分析结果生成综合报告:

**数据**:
${JSON.stringify(validResults, null, 2)}

**报告结构**:

# 招考网站爬虫可行性分析报告

## 一、整体情况统计
- 渲染方式分布 (SSR/CSR/HYBRID)
- 可行性分布 (HIGH/MEDIUM/LOW/BLOCKED)
- 推荐方案分布 (CHEERIO/PUPPETEER/API/SKIP)

## 二、可直接用 HTML 解析的网站 (CHEERIO)
列出所有 recommendation=CHEERIO 的网站，附带 selector 配置

## 三、需要浏览器的网站 (PUPPETEER)
列出所有 recommendation=PUPPETEER 的网站，说明原因

## 四、可用 API 的网站
列出所有 hasApi=true 的网站，说明接口情况

## 五、暂时无法接入的网站
列出所有 BLOCKED 或 SKIP 的网站，说明原因

## 六、自动化部署方案
1. Cloudflare Workers 覆盖率评估
2. 是否需要独立服务器运行 Puppeteer
3. 定时任务频率建议
4. 预估成本

## 七、下一步行动
1. 优先接入的 5-10 个网站（按 feasibility 和重要性）
2. 需要生成的 selector 配置文件
3. 需要特殊处理的问题

用 Markdown 格式输出。`;

const report = await agent(reportPrompt, {
  label: '生成分析报告',
  phase: '生成报告'
});

log('报告生成完成');

return {
  totalAnalyzed: validResults.length,
  report: report,
  rawData: validResults
};
