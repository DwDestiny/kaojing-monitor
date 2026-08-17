export const meta = {
  name: 'build-crawlers',
  description: '批量生成 9 个网站的爬虫适配器并测试',
  phases: [
    { title: '加载配置', detail: '读取网站分析结果' },
    { title: '生成适配器', detail: '为每个网站生成爬虫代码', model: 'opus' },
    { title: '测试验证', detail: '运行适配器验证数据抓取', model: 'haiku' }
  ]
};

// 从分析结果中加载可用网站配置
const sitesConfig = [
  {
    id: 'xinjiang_btpta',
    name: '新疆兵团人事考试院',
    url: 'http://btpta.xjbt.gov.cn',
    listPageUrl: 'http://btpta.xjbt.gov.cn/tzgg/',
    region: '新疆兵团',
    containerSelector: 'div.con ul',
    itemSelector: 'li',
    titleSelector: 'a@title',
    urlSelector: 'a@href',
    dateSelector: 'span.fr',
    paginationType: 'static-file',  // index.shtml, index_2.shtml
    paginationPattern: 'index_{page}.shtml',
    encoding: 'utf-8'
  },
  {
    id: 'beijing_rsj',
    name: '北京市人力资源和社会保障局',
    url: 'https://rsj.beijing.gov.cn',
    listPageUrl: 'https://rsj.beijing.gov.cn/xxgk/tzgg/',
    region: '北京',
    containerSelector: 'ul.list',
    itemSelector: 'ul.list > li',
    titleSelector: 'bt > a',
    urlSelector: 'bt > a@href',
    dateSelector: 'span',
    paginationType: 'static-file',
    paginationPattern: 'index_{page}.html',
    totalPages: 100,
    needDetailPage: true,  // 需要二次进入详情页
    encoding: 'utf-8'
  },
  {
    id: 'beijing_jgj',
    name: '北京市级机关事业单位招聘平台',
    url: 'https://zhaopin.jgj.beijing.gov.cn',
    listPageUrl: 'https://zhaopin.jgj.beijing.gov.cn/Notice.html',
    region: '北京',
    containerSelector: 'div.zp_content',
    itemSelector: 'a',
    titleSelector: 'p',
    urlSelector: 'a@href',
    dateSelector: 'span',
    paginationType: 'url-param',  // ?page=N
    paginationPattern: '?page={page}',
    encoding: 'utf-8'
  },
  {
    id: 'tianjin_hrss',
    name: '天津市人力资源和社会保障局',
    url: 'https://hrss.tj.gov.cn',
    listPageUrl: 'https://hrss.tj.gov.cn/xinwenzixun/gggsnew/',
    region: '天津',
    containerSelector: 'div.con-listcon ul',
    itemSelector: 'li',
    titleSelector: 'a@title',
    urlSelector: 'a@href',
    dateSelector: 'span.fr',
    paginationType: 'static-file',
    paginationPattern: 'index_{page}.shtml',
    encoding: 'utf-8'
  },
  {
    id: 'guangdong_hrss',
    name: '广东省人力资源和社会保障厅',
    url: 'https://hrss.gd.gov.cn',
    listPageUrl: 'https://hrss.gd.gov.cn/zwgk/sydwzp/index.html',
    region: '广东',
    containerSelector: 'ul.list',
    itemSelector: 'li',
    titleSelector: 'a@title',
    urlSelector: 'a@href',
    dateSelector: 'span.pubDate',
    paginationType: 'static-file',
    paginationPattern: 'index_{page}.html',
    totalPages: 200,
    encoding: 'utf-8'
  },
  {
    id: 'jiangsu_hrss',
    name: '江苏省人力资源和社会保障厅',
    url: 'https://jshrss.jiangsu.gov.cn',
    listPageUrl: 'https://jshrss.jiangsu.gov.cn/col/col78503/index.html',
    region: '江苏',
    apiUrl: 'https://jshrss.jiangsu.gov.cn/module/web/jpage/dataproxy.jsp',
    apiType: 'xml',
    crawlerType: 'api',  // 优先用 API
    fallbackHtml: true,  // API 失败时降级到 HTML
    encoding: 'utf-8'
  },
  {
    id: 'shandong_hrss',
    name: '山东省人力资源和社会保障厅',
    url: 'https://hrss.shandong.gov.cn',
    listPageUrl: 'https://hrss.shandong.gov.cn/channels/ch00232/',
    region: '山东',
    containerSelector: 'div.news_box01_con ul',
    itemSelector: 'li.pagedContent',
    titleSelector: 'span.news_box01_title',
    urlSelector: 'a@href',
    dateSelector: 'span:nth-of-type(2)',
    paginationType: 'hybrid',  // 前 50 页客户端分页，51+ 页静态文件
    paginationPattern: 'index_{page}.shtml',
    clientPaginationLimit: 50,
    encoding: 'utf-8'
  },
  {
    id: 'fujian_rst',
    name: '福建省人力资源和社会保障厅',
    url: 'https://rst.fujian.gov.cn',
    listPageUrl: 'https://rst.fujian.gov.cn/zw/gsgg/',
    region: '福建',
    containerSelector: 'ul.clearflx.nyncgl-box-list',
    itemSelector: 'li',
    titleSelector: 'p',
    urlSelector: 'a@href',
    dateSelector: 'span.bf-pass',
    paginationType: 'static-file',
    paginationPattern: 'index_{page}.html',
    totalPages: 7,  // MVP 只爬前 7 页（静态 HTML）
    encoding: 'utf-8'
  },
  {
    id: 'chongqing_rlsbj',
    name: '重庆市人力资源和社会保障局',
    url: 'https://rlsbj.cq.gov.cn',
    listPageUrl: 'https://rlsbj.cq.gov.cn/tzgg/',
    region: '重庆',
    containerSelector: 'TBD',  // 需要验证
    itemSelector: 'li',
    titleSelector: 'a',
    urlSelector: 'a@href',
    dateSelector: 'span',
    paginationType: 'static-file',
    needVerify: true,
    encoding: 'utf-8'
  }
];

log(`准备为 ${sitesConfig.length} 个网站生成爬虫适配器`);

// Phase 1: 生成适配器
phase('生成适配器');

const adapterResults = await pipeline(
  sitesConfig,

  async (site, _, index) => {
    const prompt = `为 ${site.name} 生成一个爬虫适配器模块。

**网站配置**:
${JSON.stringify(site, null, 2)}

**任务要求**:
1. 创建文件 \`/Users/dw/Desktop/张晗/粉笔/考情监测/crawlers/adapters/${site.id}.js\`
2. 实现 \`fetchAnnouncements(page = 1)\` 函数
3. 返回标准化数据格式:
   \`\`\`js
   {
     title: string,           // 完整标题
     url: string,            // 绝对 URL
     publishDate: string,    // YYYY-MM-DD
     source: string,         // 来源网站名称
     region: string,         // 地区
     rawHtml: string         // 用于后续提取详细信息
   }
   \`\`\`

4. 技术栈: ES Modules, axios, cheerio
5. 错误处理: try-catch + 日志
6. User-Agent: 明确标识爬虫身份
7. 超时: 10 秒
8. 相对 URL 自动转绝对路径
9. 如果 needDetailPage=true，实现 \`fetchDetail(url)\` 函数

**合规要求**:
- User-Agent 设置为: "KaoQingBot/1.0 (Recruitment Info Aggregator; +http://example.com/about)"
- 每次请求间隔至少 1 秒
- 遵守 robots.txt

**特殊处理**:
- 如果 crawlerType='api'，调用 API 接口而非解析 HTML
- 如果 paginationType='url-param'，URL 拼接参数
- 如果 paginationType='static-file'，替换文件名中的 {page}

**测试函数**:
添加 \`if (import.meta.url === \`file://\${process.argv[1]}\`) { ... }\` 测试块，运行时输出前 5 条数据`;

    return await agent(prompt, {
      label: `[${index + 1}/${sitesConfig.length}] ${site.name}`,
      phase: '生成适配器'
    });
  }
);

log(`适配器生成完成: ${adapterResults.filter(Boolean).length}/${sitesConfig.length}`);

// Phase 2: 测试验证
phase('测试验证');

const testResults = await pipeline(
  sitesConfig.filter((_, i) => adapterResults[i]),  // 只测试成功生成的

  async (site, _, index) => {
    const prompt = `测试爬虫适配器 ${site.id}:

1. 运行 \`node /Users/dw/Desktop/张晗/粉笔/考情监测/crawlers/adapters/${site.id}.js\`
2. 验证输出:
   - 至少返回 1 条数据
   - title 不为空
   - url 是完整的 http/https 链接
   - publishDate 格式正确
3. 检查错误日志
4. 返回测试结果:
   \`\`\`json
   {
     "success": true/false,
     "dataCount": number,
     "sampleData": {...},  // 第一条数据
     "errors": []
   }
   \`\`\``;

    return await agent(prompt, {
      schema: {
        type: 'object',
        required: ['success', 'dataCount'],
        properties: {
          success: { type: 'boolean' },
          dataCount: { type: 'number' },
          sampleData: { type: 'object' },
          errors: { type: 'array', items: { type: 'string' } }
        }
      },
      label: `测试 ${site.name}`,
      phase: '测试验证',
      model: 'haiku'
    });
  }
);

const successCount = testResults.filter(r => r && r.success).length;
log(`测试完成: ${successCount}/${testResults.length} 个适配器通过`);

// 生成汇总报告
const summary = {
  total: sitesConfig.length,
  generated: adapterResults.filter(Boolean).length,
  tested: testResults.length,
  passed: successCount,
  failed: testResults.filter(r => r && !r.success).map((r, i) => ({
    site: sitesConfig[i].name,
    errors: r.errors
  }))
};

return summary;
