/**
 * 爬虫工具函数
 */

import { URL } from 'url';

/**
 * 将相对 URL 转换为绝对 URL
 * @param {string} baseUrl - 基础 URL
 * @param {string} relativeUrl - 相对 URL
 * @returns {string} 绝对 URL
 */
export function resolveUrl(baseUrl, relativeUrl) {
  if (!relativeUrl) return '';

  // 已经是绝对 URL
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }

  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch (error) {
    console.warn(`URL 解析失败: ${baseUrl} + ${relativeUrl}`, error);
    return relativeUrl;
  }
}

/**
 * 统一日期格式为 YYYY-MM-DD
 * @param {string} dateStr - 原始日期字符串
 * @returns {string} YYYY-MM-DD 格式
 */
export function parseDate(dateStr) {
  if (!dateStr) return '';

  // 已经是标准格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // 尝试解析常见格式
  // 2026-08-17, 2026/08/17, 2026.08.17
  const match = dateStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return dateStr;
}

/**
 * 延迟函数
 * @param {number} ms - 毫秒
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 从 HTML 中提取内容
 * @param {CheerioAPI} $ - Cheerio 实例
 * @param {Cheerio} $element - 元素
 * @param {string} selector - 选择器（支持 @attr 语法）
 * @returns {string} 提取的内容
 */
export function extractFromHtml($, $element, selector) {
  if (!selector) return '';

  // 支持 a@href, img@src 等属性选择器
  const [sel, attr] = selector.split('@');
  const $target = sel ? $element.find(sel).first() : $element;

  if (attr) {
    return $target.attr(attr) || '';
  }

  return $target.text().trim();
}

/**
 * 随机延迟 1-2 秒（合规爬取）
 */
export async function randomDelay() {
  const delay = 1000 + Math.random() * 1000; // 1000-2000ms
  await sleep(delay);
}

/**
 * 指数退避重试
 * @param {Function} fn - 要执行的函数
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<any>} 函数执行结果
 */
export async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`重试 ${i + 1}/${maxRetries}，等待 ${delay}ms...`);
      await sleep(delay);
    }
  }
}
