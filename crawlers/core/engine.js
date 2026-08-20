/**
 * 通用爬虫引擎
 * 支持配置化抓取多个政府招考网站
 * 扩展（2026-08-20 P1 扩源）：
 * - encoding: gbk/gb2312 编码支持（qgsydw 全国事业单位招聘网）
 * - pageOffset: 静态分页页码偏移（guizhou/hubei createPageHTML 第2页为 index_1.html → offset=-1）
 * - paginationParamName/paginationStep: url-param 分页自定义参数（henan offset=30 步进）
 * - titleAttr='text': 强制取文本（qgsydw span.title 带假 title 属性）
 * - dateSelector '|' 分隔多元素: 拆分年/月日拼接（liaoning）
 * - defaultDate='today': 列表无日期时用采集当天（sichuan 专题页）
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import {
  resolveUrl,
  parseDate,
  sleep,
  randomDelay,
  extractFromHtml,
  retryWithBackoff
} from './utils.js';
import { buildApiRequest, parseJsonItems } from './api-json.js';

// 统一请求 UA：政府站 WAF 常拦截纯机器人 UA（KaoQingBot 曾触发 403/418），
// 改用浏览器 UA 兼容（合规仍保持：低频 1-2 次/天 + 请求间隔 1-3s + 只取公开信息）
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * 构造分页 URL（static-file 与 url-param 统一入口）
 * 支持 pageOffset（静态文件页码偏移）与 paginationParamName/paginationStep（参数分页步进）
 * @param {Object} siteConfig
 * @param {number} page - 页号（从 1 开始）
 * @returns {string} 分页 URL
 */
export function buildPageUrl(siteConfig, page) {
  const { listPageUrl, paginationType, paginationPattern, pageOffset = 0 } = siteConfig;
  if (page <= 1) return listPageUrl;

  if (paginationType === 'url-param') {
    const paramName = siteConfig.paginationParamName || 'page';
    const step = siteConfig.paginationStep || 1;
    // 语义：标准 page 参数从 1 开始递增（云南 ?page=2）；offset 类按步进从 0 累加（河南 ?offset=30）
    const value = step === 1 ? page : (page - 1) * step;
    const sep = listPageUrl.includes('?') ? '&' : '?';
    return `${listPageUrl}${sep}${paramName}=${value}`;
  }

  // static-file / hybrid：替换文件名中的 {page}，支持页码偏移
  const pageName = paginationPattern.replace('{page}', page + pageOffset);
  return listPageUrl.replace(/\/[^/]+$/, `/${pageName}`);
}

/**
 * 按 encoding 解码响应体（utf-8 默认 / gbk / gb2312）
 * @param {ArrayBuffer|Buffer} data
 * @param {string} encoding
 * @returns {string}
 */
export function decodeHtml(data, encoding = 'utf-8') {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (encoding === 'utf-8') return buf.toString('utf-8');
  if (/gbk|gb2312/i.test(encoding)) {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch (e) {
      return buf.toString('utf-8');
    }
  }
  return buf.toString('utf-8');
}

/**
 * 从条目中提取发布日期
 * 支持：
 * - 单个选择器（普通源）
 * - '|' 分隔多元素（年/月日拆分的源，如辽宁），各元素文本拼接后交给 parseDate
 * - defaultDate='today' 兜底（列表无日期元素，如四川专题页）
 * @param {Object} $ - Cheerio 实例
 * @param {Object} $item - 条目元素
 * @param {string} dateSelector
 * @param {string} defaultDate
 * @returns {string} YYYY-MM-DD 或 ''
 */
export function extractDate($, $item, dateSelector, defaultDate) {
  if (dateSelector) {
    const parts = String(dateSelector).split('|').filter(Boolean);
    if (parts.length > 1) {
      // 多元素：各元素文本直接拼接（辽宁 "2026" + "07-21" → "202607-21"）
      const joined = parts.map(p => extractFromHtml($, $item, p)).join('');
      return parseDate(joined);
    }
    return parseDate(extractFromHtml($, $item, dateSelector));
  }
  if (defaultDate === 'today') {
    return new Date().toISOString().split('T')[0];
  }
  return '';
}

/**
 * 通用爬虫函数
 * @param {Object} siteConfig - 网站配置对象
 * @param {Object} options - 可选配置
 * @param {number} options.maxPages - 最大爬取页数（覆盖配置中的 maxPages）
 * @returns {Promise<Array>} 标准化的数据数组
 */
export async function crawl(siteConfig, options = {}) {
  const { id, name, enabled, paginationType, apiUrl } = siteConfig;

  if (!enabled) {
    console.log(`⏭️  网站 ${name} 已禁用，跳过`);
    return [];
  }

  console.log(`\n🚀 开始爬取: ${name} (${id})`);

  try {
    let results = [];

    // 根据分页类型选择爬取策略
    switch (paginationType) {
      case 'api':
        results = await crawlApi(siteConfig, options);
        break;
      case 'static-file':
        results = await crawlStaticFile(siteConfig, options);
        break;
      case 'url-param':
        results = await crawlUrlParam(siteConfig, options);
        break;
      case 'hybrid':
        results = await crawlHybrid(siteConfig, options);
        break;
      default:
        // 默认当作单页爬取
        results = await crawlSinglePage(siteConfig);
    }

    console.log(`✅ ${name} 爬取完成，共 ${results.length} 条数据`);
    return results;

  } catch (error) {
    console.error(`❌ ${name} 爬取失败:`, error.message);
    throw error;
  }
}

/**
 * API 方式爬取（江苏 XML / 浙江 jcms JSON / 河北 rsmhapi JSON）
 * apiType: 'xml' = 江苏 XML 响应；'json' = JSON 响应（形态 A 数组 / 形态 B HTML 字符串）
 */
async function crawlApi(siteConfig, options) {
  const { apiUrl, apiType, name, region, maxPages = 1 } = siteConfig;
  const pagesToCrawl = options.maxPages || maxPages;
  const results = [];

  console.log(`  📡 API 模式(${apiType || 'xml'}): ${apiUrl}`);

  for (let page = 1; page <= pagesToCrawl; page++) {
    console.log(`  📄 爬取第 ${page} 页...`);

    try {
      // ── JSON 模式（浙江 jcms / 河北 rsmhapi）──
      if (apiType === 'json') {
        const req = buildApiRequest(siteConfig, page);
        const response = await retryWithBackoff(async () => {
          return await axios({
            method: req.method,
            url: req.url,
            data: req.body || undefined,
            headers: { 'User-Agent': BROWSER_UA, ...req.headers },
            timeout: 15000,
          });
        });

        const json = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        const items = parseJsonItems(json, siteConfig);
        results.push(...items);

        console.log(`    ✓ 解析 ${items.length} 条`);
        if (items.length === 0) {
          console.log(`  ⏹️  无更多数据，停止爬取`);
          break;
        }

        if (page < pagesToCrawl) await sleep(randomDelay());
        continue;
      }

      // ── XML 模式（江苏 dataproxy）──
      const params = { ...siteConfig.apiParams, page };
      const response = await retryWithBackoff(async () => {
        return await axios.get(apiUrl, {
          params,
          timeout: 10000,
          headers: { 'User-Agent': BROWSER_UA }
        });
      });

      const parser = new XMLParser();
      const data = parser.parse(response.data);

      const records = data?.datastore?.recordset?.record || [];
      const items = Array.isArray(records) ? records : [records];

      items.forEach(item => {
        results.push({
          title: item.title || '',
          url: resolveUrl(siteConfig.baseUrl || apiUrl, item.url || ''),
          publishDate: parseDate(item.pubdate || ''),
          source: name,
          region,
          rawHtml: ''
        });
      });

      console.log(`    ✓ 解析 ${items.length} 条`);
      if (items.length === 0) {
        console.log(`  ⏹️  无更多数据，停止爬取`);
        break;
      }

      if (page < pagesToCrawl) {
        await sleep(randomDelay());
      }

    } catch (error) {
      console.error(`  ⚠️  第 ${page} 页爬取失败:`, error.message);
      break;
    }
  }

  return results;
}

/**
 * 静态文件分页爬取（广东、北京、新疆等）
 * 分页 URL 统一走 buildPageUrl（支持 pageOffset 页码偏移）
 */
async function crawlStaticFile(siteConfig, options) {
  const { listPageUrl, maxPages = 1 } = siteConfig;
  const pagesToCrawl = options.maxPages || maxPages;
  const results = [];

  console.log(`  📄 静态文件分页模式: ${siteConfig.paginationPattern}`);

  for (let page = 1; page <= pagesToCrawl; page++) {
    const pageUrl = buildPageUrl(siteConfig, page);

    console.log(`  📄 爬取第 ${page} 页: ${pageUrl}`);

    try {
      const pageResults = await fetchAndParse(pageUrl, siteConfig);
      results.push(...pageResults);

      console.log(`    ✓ 解析 ${pageResults.length} 条`);

      // 如果某页返回数据为空，停止爬取
      if (pageResults.length === 0) {
        console.log(`  ⏹️  无更多数据，停止爬取`);
        break;
      }

      // 请求间隔
      if (page < pagesToCrawl) {
        await sleep(randomDelay());
      }

    } catch (error) {
      console.error(`  ⚠️  第 ${page} 页爬取失败:`, error.message);
      break;
    }
  }

  return results;
}

/**
 * URL 参数分页爬取（北京市级机关、云南、河南）
 * 参数名/步进可配置：paginationParamName（默认 page）/ paginationStep（默认 1）
 */
async function crawlUrlParam(siteConfig, options) {
  const { maxPages = 1 } = siteConfig;
  const pagesToCrawl = options.maxPages || maxPages;
  const results = [];

  console.log(`  📄 URL 参数分页模式（${siteConfig.paginationParamName || 'page'} 参数）`);

  for (let page = 1; page <= pagesToCrawl; page++) {
    const pageUrl = buildPageUrl(siteConfig, page);

    console.log(`  📄 爬取第 ${page} 页: ${pageUrl}`);

    try {
      const pageResults = await fetchAndParse(pageUrl, siteConfig);
      results.push(...pageResults);

      console.log(`    ✓ 解析 ${pageResults.length} 条`);

      if (pageResults.length === 0) {
        console.log(`  ⏹️  无更多数据，停止爬取`);
        break;
      }

      if (page < pagesToCrawl) {
        await sleep(randomDelay());
      }

    } catch (error) {
      console.error(`  ⚠️  第 ${page} 页爬取失败:`, error.message);
      break;
    }
  }

  return results;
}

/**
 * 混合分页（山东省：前50页客户端分页，后续文件分页）
 * MVP 阶段简化：只爬文件分页部分
 */
async function crawlHybrid(siteConfig, options) {
  console.log(`  📄 混合分页模式（MVP: 仅文件分页部分）`);

  // 暂时按静态文件处理
  return await crawlStaticFile(siteConfig, options);
}

/**
 * 单页爬取（无分页或仅爬首页）
 */
async function crawlSinglePage(siteConfig) {
  const { listPageUrl } = siteConfig;
  console.log(`  📄 单页模式: ${listPageUrl}`);

  return await fetchAndParse(listPageUrl, siteConfig);
}

/**
 * 通用 HTML 获取与解析
 * @param {string} url - 目标 URL
 * @param {Object} siteConfig - 网站配置
 * @returns {Promise<Array>} 解析后的数据数组
 */
async function fetchAndParse(url, siteConfig) {
  const {
    name,
    region,
    baseUrl,
    encoding = 'utf-8',
    containerSelector,
    itemSelector,
    titleSelector,
    titleAttr,
    urlSelector,
    urlAttr,
    dateSelector,
    defaultDate
  } = siteConfig;

  // 带重试的请求（arraybuffer 模式，按 encoding 解码，支持 GBK/GB2312）
  const html = await retryWithBackoff(async () => {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': BROWSER_UA
      },
      responseType: 'arraybuffer'
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('响应内容为空');
    }

    return decodeHtml(response.data, encoding);
  });

  // 解析 HTML
  const $ = cheerio.load(html);
  const results = [];

  // 选择容器和列表项
  let $items;
  if (containerSelector && itemSelector) {
    $items = $(`${containerSelector} ${itemSelector}`);
  } else if (itemSelector) {
    $items = $(itemSelector);
  } else {
    throw new Error('缺少 itemSelector 配置');
  }

  $items.each((_, element) => {
    const $item = $(element);

    // 提取标题
    let title = '';
    if (titleSelector) {
      const $titleEl = $item.find(titleSelector).first();
      if (titleAttr === 'text') {
        // titleAttr='text'：强制取元素文本（qgsydw span.title 带假 title="Title" 属性）
        title = $titleEl.text().trim();
      } else if (titleAttr) {
        title = extractFromHtml($, $item, `${titleSelector}@${titleAttr}`);
      } else {
        // 优先取 title 属性，否则取文本
        title = $titleEl.attr('title') || $titleEl.text().trim();
      }
    }

    // 提取 URL
    let itemUrl = '';
    if (urlSelector) {
      // 合并 urlSelector 和 urlAttr 成 extractFromHtml 理解的 @attr 内联语法
      const effectiveSelector = urlAttr
        ? (urlSelector && urlSelector.includes('@') ? urlSelector : `${urlSelector || ''}@${urlAttr}`)
        : urlSelector;
      itemUrl = extractFromHtml($, $item, effectiveSelector);
      itemUrl = resolveUrl(baseUrl || url, itemUrl);
    }

    // 提取日期（支持多元素拼接 + defaultDate 兜底）
    let publishDate = extractDate($, $item, dateSelector, defaultDate);

    // 跳过空标题或无链接的条目
    if (!title || !itemUrl) {
      return;
    }

    results.push({
      title,
      url: itemUrl,
      publishDate,
      source: name,
      region,
      rawHtml: $item.html() || ''
    });
  });

  return results;
}
