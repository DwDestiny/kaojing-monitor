/**
 * JSON API 爬取模式纯函数（P1C 新增，2026-08-20）
 * 支持两种形态：
 *   A. JSON 数组响应（河北 rsmhapi）：{ data: { list: [...] } }
 *   B. HTML 字符串响应（浙江 jcms）：{ data: { html: "<li><a>标题</a><span>日期</span></li>" } }
 * 供 engine.crawlApi 的 apiType='json' 分支调用（纯函数，可单测）
 */
import * as cheerio from 'cheerio';
import { resolveUrl, parseDate } from './utils.js';

/**
 * 按点路径取值（'data.list' → data.list；支持数字下标 'data.rows.0'）
 */
export function getPath(obj, path) {
  if (!obj || !path) return undefined;
  return String(path).split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[key];
  }, obj);
}

/**
 * 构造 API 请求
 * @param {Object} siteConfig - apiType='json' 的站点配置
 * @param {number} page - 页号（从 1 开始）
 * @returns {{method: string, url: string, headers?: object, body?: string|null}}
 */
export function buildApiRequest(siteConfig, page) {
  const { apiUrl, apiMethod = 'GET', apiHeaders = {}, apiParams = {}, apiBody = {}, paginationParam = 'pageNum' } = siteConfig;

  if (String(apiMethod).toUpperCase() === 'POST') {
    return {
      method: 'POST',
      url: apiUrl,
      headers: { 'Content-Type': 'application/json', ...apiHeaders },
      body: JSON.stringify({ ...apiBody, [paginationParam]: page, pageSize: apiBody.pageSize || 20 }),
    };
  }

  // GET：普通参数注入 或 浙江 jcms 的 paramJson 模板
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(apiParams)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  if (siteConfig.paramJsonTemplate) {
    const paramJson = JSON.stringify({
      ...siteConfig.paramJsonTemplate,
      [siteConfig.paramJsonPageParam || 'pageNo']: page,
    });
    params.set('paramJson', paramJson);
  } else {
    params.set(paginationParam, String(page));
  }
  const sep = apiUrl.includes('?') ? '&' : '?';
  return { method: 'GET', url: `${apiUrl}${sep}${params.toString()}`, headers: apiHeaders, body: null };
}

/**
 * 解析 JSON 响应为标准化条目
 * @param {object} data - 已解析的 JSON
 * @param {object} siteConfig
 * @returns {Array<{title, url, publishDate, rawHtml}>}
 */
export function parseJsonItems(data, siteConfig) {
  const { itemsPath, htmlPath, itemContainer = 'li', titleSelector, urlSelector, urlAttr = 'href', dateSelector, baseUrl, name, region } = siteConfig;

  if (!itemsPath && !htmlPath) {
    throw new Error('JSON API 模式缺少配置: itemsPath 或 htmlPath 必须设置其一');
  }

  // 形态 B：HTML 字符串响应（浙江 jcms）
  if (htmlPath) {
    const html = getPath(data, htmlPath);
    if (!html || typeof html !== 'string') return [];
    return parseHtmlItems(html, siteConfig);
  }

  // 形态 A：JSON 数组
  const items = itemsPath ? getPath(data, itemsPath) : data;
  if (!Array.isArray(items)) return [];

  return items
    .map(it => {
      if (!it || typeof it !== 'object') return null;
      const title = it.title || it.name || it.subject || it.shortTitle || '';
      // URL：优先字段值；无则用 urlTemplate 模板（如河北 pageWarp?isId={id}）
      let url = resolveUrl(baseUrl || '', it.url || it.link || it.href || '');
      if (!url && siteConfig.urlTemplate && it.id) {
        url = siteConfig.urlTemplate.replace(/\{id\}/g, it.id);
      }
      if (!title || !url) return null;
      return {
        title: String(title).trim(),
        url,
        publishDate: parseDate(it.publishDate || it.publishedDate || it.pubDate || it.date || it.createTime || ''),
        source: name,
        region,
        rawHtml: it.content || it.snippet || it.articleContent || '',
      };
    })
    .filter(Boolean);
}

/**
 * 形态 B：从 HTML 字符串解析列表（浙江 jcms data.html）
 */
function parseHtmlItems(html, siteConfig) {
  const { itemContainer = 'li', titleSelector, urlSelector, urlAttr = 'href', dateSelector, baseUrl, name, region, defaultDate } = siteConfig;
  const $ = cheerio.load(html);
  const results = [];

  $(itemContainer).each((_, el) => {
    const $item = $(el);

    let title = '';
    if (titleSelector) {
      const $t = $item.find(titleSelector).first();
      title = $t.attr('title') || $t.text().trim();
    }

    let itemUrl = '';
    if (urlSelector) {
      const $u = $item.find(urlSelector).first();
      itemUrl = $u.attr(urlAttr) || '';
      itemUrl = resolveUrl(baseUrl || '', itemUrl);
    }

    let publishDate = '';
    if (dateSelector) {
      publishDate = parseDate($item.find(dateSelector).first().text().trim());
    } else if (defaultDate === 'today') {
      publishDate = new Date().toISOString().split('T')[0];
    }

    if (!title) return;
    results.push({ title, url: itemUrl, publishDate, source: name, region, rawHtml: '' });
  });

  return results;
}
