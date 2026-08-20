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
 * 支持：
 * - 标准格式 2026-08-17
 * - 常见分隔 2026/08/17、2026.08.17
 * - 从长文本提取（"发布时间：2026-08-14"、"[2026-08-06]"）
 * - 年与月日拆分的拼接文本（辽宁人事考试网："2026" + "07-21" → "202607-21" → 2026-07-21）
 * @param {string} dateStr - 原始日期字符串
 * @returns {string} YYYY-MM-DD 格式（解析失败返回原串）
 */
export function parseDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();

  // 已经是标准格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // 常见格式（含从长文本/方括号中提取）
  // 2026-08-17, 2026/08/17, 2026.08.17, 发布时间：2026-08-14, [2026-08-06]
  const full = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (full) {
    const [, year, month, day] = full;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 年与月日拆分（辽宁："202607-21" 来自 "2026" + "07-21"）
  const yearMatch = s.match(/(\d{4})/);
  const mdMatch = s.match(/(\d{1,2})[-/.](\d{1,2})/);
  if (yearMatch && mdMatch) {
    // 排除纯年份串本身被当"年+月日"误解析（"2026" 无月日）
    const yearOnly = /^\d{4}$/.test(s);
    if (!yearOnly) {
      const [, year] = yearMatch;
      const [, month, day] = mdMatch;
      // 校验月日范围，避免把 2026 拆成 20-26
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  }

  return s;
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
 * 生成随机延迟毫秒数
 * @param {number} min - 最小毫秒数（默认 1000）
 * @param {number} max - 最大毫秒数（默认 2000）
 * @returns {number} 随机延迟毫秒数
 */
export function randomDelay(min = 1000, max = 2000) {
  return Math.floor(min + Math.random() * (max - min));
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
