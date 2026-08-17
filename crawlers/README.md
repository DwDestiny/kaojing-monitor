# 考情监测爬虫引擎

通用配置化爬虫引擎，支持多个政府招考网站的自动化数据采集。

## 目录结构

```
/crawlers
  /core
    engine.js           # 通用爬虫引擎
    utils.js            # 工具函数库
  /config
    sites.json          # 网站配置文件（9个网站）
  test.js               # 测试脚本
  package.json          # 依赖配置
```

## 快速开始

### 1. 安装依赖

```bash
cd /Users/dw/Desktop/张晗/粉笔/考情监测/crawlers
npm install
```

### 2. 测试所有网站

```bash
npm test
```

### 3. 测试指定网站

```bash
node test.js guangdong_hrss
```

可用的网站 ID：
- `guangdong_hrss` - 广东省人社厅
- `xinjiang_btpta` - 新疆兵团人事考试院
- `beijing_hrss` - 北京市人社局
- `beijing_zhaopin` - 北京市级机关招聘平台
- `tianjin_hrss` - 天津市人社局
- `jiangsu_hrss` - 江苏省人社厅（API）
- `shandong_hrss` - 山东省人社厅
- `fujian_hrss` - 福建省人社厅
- `chongqing_hrss` - 重庆市人社局（暂时禁用）

## 使用示例

```javascript
import { crawl } from './core/engine.js';
import sitesConfig from './config/sites.json' assert { type: 'json' };

// 爬取广东省人社厅前3页
const guangdong = sitesConfig.sites.find(s => s.id === 'guangdong_hrss');
const results = await crawl(guangdong, { maxPages: 3 });

console.log(`爬取到 ${results.length} 条数据`);
results.forEach(item => {
  console.log(`标题: ${item.title}`);
  console.log(`链接: ${item.url}`);
  console.log(`日期: ${item.publishDate}`);
  console.log('---');
});
```

## 返回数据格式

```javascript
[
  {
    title: "2024年XX事业单位招聘公告",
    url: "https://example.com/detail/123.html",
    publishDate: "2024-01-15",
    source: "广东省人力资源和社会保障厅",
    region: "广东",
    rawHtml: "<li>...</li>"
  }
]
```

## 配置说明

### 支持的分页类型

1. **static-file**：静态文件分页
   - 例：`index.html`, `index_2.html`, `index_3.html`
   - 适用：广东、北京、新疆、天津、福建

2. **url-param**：URL 参数分页
   - 例：`?page=1`, `?page=2`
   - 适用：北京市级机关

3. **api**：API 调用（XML/JSON）
   - 适用：江苏省人社厅

4. **hybrid**：混合分页（MVP 简化为文件分页）
   - 适用：山东省人社厅

### 添加新网站

在 `config/sites.json` 中添加配置：

```json
{
  "id": "site_id",
  "name": "网站名称",
  "enabled": true,
  "region": "地区",
  "listPageUrl": "列表页URL",
  "paginationType": "static-file",
  "paginationPattern": "index_{page}.html",
  "maxPages": 5,
  "baseUrl": "https://example.com",
  "encoding": "utf-8",
  "containerSelector": "ul.list",
  "itemSelector": "li",
  "titleSelector": "a",
  "titleAttr": "title",
  "urlSelector": "a",
  "urlAttr": "href",
  "dateSelector": "span.date"
}
```

## 合规说明

- **User-Agent**：`KaoQingBot/1.0 (Recruitment Info Aggregator; Contact: admin@example.com)`
- **请求间隔**：每次请求间隔 1-2 秒随机延迟
- **超时设置**：10 秒
- **错误重试**：3 次，指数退避（1s, 2s, 4s）

## 技术栈

- **Node.js** (ES Modules)
- **axios** ^1.7.0 - HTTP 请求
- **cheerio** ^1.0.0 - HTML 解析
- **fast-xml-parser** ^4.5.0 - XML 解析（江苏省 API）

## 已知问题

1. **重庆市人社局**：可能需要代理访问，当前配置已禁用
2. **山东省混合分页**：MVP 阶段仅支持文件分页部分
3. **福建省**：仅爬取前 7 页（静态 HTML 部分）

## 后续优化

- [ ] 支持详情页二次提取（北京市人社局）
- [ ] 增加数据去重机制
- [ ] 增加增量更新检测
- [ ] 支持 Puppeteer（浙江省人社厅）
- [ ] 增加错误监控和日志
- [ ] 支持 Cloudflare Workers 部署
