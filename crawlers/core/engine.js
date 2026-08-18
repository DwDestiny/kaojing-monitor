/**
 * 通用爬虫引擎
 * 支持配置化抓取多个政府招考网站
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
 * API 方式爬取（江苏省）
 */
async function crawlApi(siteConfig, options) {
  const { apiUrl, apiParams, apiType, name, region, maxPages = 1 } = siteConfig;
  const pagesToCrawl = options.maxPages || maxPages;
  const results = [];

  console.log(`  📡 API 模式: ${apiUrl}`);

  for (let page = 1; page <= pagesToCrawl; page++) {
    console.log(`  📄 爬取第 ${page} 页...`);

    const params = { ...apiParams, page };

    try {
      const response = await retryWithBackoff(async () => {
        return await axios.get(apiUrl, {
          params,
          timeout: 10000,
          headers: {
            'User-Agent': 'KaoQingBot/1.0 (Recruitment Info Aggregator; Contact: admin@example.com)'
          }
        });
      });

      // 解析 XML
      if (apiType === 'xml') {
        const parser = new XMLParser();
        const data = parser.parse(response.data);

        // 根据江苏省 API 结构提取数据（需根据实际返回调整）
        const records = data?.datastore?.recordset?.record || [];
        const items = Array.isArray(records) ? records : [records];

        items.forEach(item => {
          results.push({
            title: item.title || '',
            url: resolveUrl(siteConfig.baseUrl || apiUrl, item.url || ''),
            publishDate: parseDate(item.pubdate || ''),
            source: name,
            region: region,
            rawHtml: ''
          });
        });

        console.log(`    ✓ 解析 ${items.length} 条`);

        // 如果返回数据少于预期，可能已到最后一页
        if (items.length === 0) {
          console.log(`  ⏹️  无更多数据，停止爬取`);
          break;
        }
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
 * 静态文件分页爬取（广东、北京、新疆等）
 */
async function crawlStaticFile(siteConfig, options) {
  const { listPageUrl, paginationPattern, maxPages = 1 } = siteConfig;
  const pagesToCrawl = options.maxPages || maxPages;
  const results = [];

  console.log(`  📄 静态文件分页模式: ${paginationPattern}`);

  for (let page = 1; page <= pagesToCrawl; page++) {
    let pageUrl;

    if (page === 1) {
      // 第一页通常是 index.html 或 index.shtml
      pageUrl = listPageUrl;
    } else {
      // 替换 {page} 占位符
      const pageName = paginationPattern.replace('{page}', page);
      // 将 listPageUrl 的文件名替换为分页文件名
      pageUrl = listPageUrl.replace(/\/[^\/]+$/, `/${pageName}`);
    }

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
 * URL 参数分页爬取（北京市级机关）
 */
async function crawlUrlParam(siteConfig, options) {
  const { listPageUrl, maxPages = 1 } = siteConfig;
  const pagesToCrawl = options.maxPages || maxPages;
  const results = [];

  console.log(`  📄 URL 参数分页模式`);

  for (let page = 1; page <= pagesToCrawl; page++) {
    const pageUrl = page === 1 ? listPageUrl : `${listPageUrl}?page=${page}`;

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
    dateSelector
  } = siteConfig;

  // 带重试的请求
  const html = await retryWithBackoff(async () => {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'KaoQingBot/1.0 (Recruitment Info Aggregator; Contact: admin@example.com)'
      },
      responseType: 'text',
      transformResponse: [(data) => data]
    });

    if (typeof response.data !== 'string' || response.data.length === 0) {
      throw new Error('响应内容为空或非 HTML 文本');
    }

    return response.data;
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
      if (titleAttr) {
        title = extractFromHtml($, $item, titleSelector, titleAttr);
      } else {
        // 优先取 title 属性，否则取文本
        const $titleEl = $item.find(titleSelector).first();
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

    // 提取日期
    let publishDate = '';
    if (dateSelector) {
      publishDate = extractFromHtml($, $item, dateSelector);
      publishDate = parseDate(publishDate);
    }

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
