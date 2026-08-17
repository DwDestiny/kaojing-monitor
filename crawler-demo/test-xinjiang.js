/**
 * 新疆兵团人事考试网爬虫 Demo
 * 目标: http://btpta.xjbt.gov.cn/tzgg/
 * 验证列表页标题、链接、发布日期的抓取与解析能力
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

/** 目标列表页 URL */
const TARGET_URL = 'http://btpta.xjbt.gov.cn/tzgg/';

/** 站点根地址，用于拼接相对路径为绝对 URL */
const BASE_URL = 'http://btpta.xjbt.gov.cn';

/** 输出条数上限 */
const MAX_ITEMS = 20;

/**
 * 将相对 href 转为绝对 URL
 * @param {string} href - a 标签的 href 属性
 * @returns {string} 完整 URL
 */
function toAbsoluteUrl(href) {
  if (!href) return '';
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  // 站点路径通常以 / 开头，直接拼接根地址
  return `${BASE_URL}${href.startsWith('/') ? href : `/${href}`}`;
}

/**
 * 从列表页 HTML 中解析公告条目
 * 实际结构（与任务参考略有差异）:
 *   <div class="con"><ul><li><span class="fr">日期</span><a title="..." href="...">...</a></li></ul></div>
 * 选择器使用 div.con ul li（任务文档写的 ul.con li 与线上 HTML 不符）
 * @param {string} html - 列表页 HTML
 * @returns {Array<{title: string, url: string, publishDate: string}>}
 */
function parseListPage(html) {
  const $ = cheerio.load(html);
  const items = [];

  // 优先匹配真实结构 div.con > ul > li；兼容任务文档中的 ul.con li
  const $listItems = $('div.con ul li').length
    ? $('div.con ul li')
    : $('ul.con li');

  $listItems.each((_, el) => {
    const $li = $(el);
    const $a = $li.find('a').first();
    const $date = $li.find('span.fr').first();

    // 标题优先取 a[title]，否则取 a 文本
    const titleAttr = $a.attr('title');
    const title = (titleAttr && titleAttr.trim()) || $a.text().trim();

    const href = $a.attr('href') || '';
    const url = toAbsoluteUrl(href);
    const publishDate = $date.text().trim();

    // 跳过空标题或无链接的条目
    if (!title || !url) return;

    items.push({ title, url, publishDate });
  });

  return items;
}

/**
 * 主流程：请求列表页 → 解析 → 输出前 20 条 JSON
 */
async function main() {
  console.log(`开始抓取: ${TARGET_URL}`);

  try {
    const response = await axios.get(TARGET_URL, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      // 部分政府站证书/重定向环境较特殊，显式跟随重定向
      maxRedirects: 5,
      responseType: 'text',
      // 防止 axios 按 JSON 解析
      transformResponse: [(data) => data],
    });

    const html = response.data;
    if (typeof html !== 'string' || html.length === 0) {
      throw new Error('响应内容为空或非 HTML 文本');
    }

    let items;
    try {
      items = parseListPage(html);
    } catch (parseError) {
      console.error('解析失败:', parseError.message || parseError);
      throw parseError;
    }

    const result = items.slice(0, MAX_ITEMS);
    console.log(`抓取成功，共解析 ${items.length} 条，输出前 ${result.length} 条：`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    // 区分网络错误与其他错误，输出详细信息
    if (error.response) {
      console.error(
        `网络请求失败: HTTP ${error.response.status} ${error.response.statusText || ''}`
      );
    } else if (error.request) {
      console.error('网络请求失败: 无响应', error.message || error);
    } else {
      console.error('抓取失败:', error.message || error);
    }
    if (error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
}

main();
