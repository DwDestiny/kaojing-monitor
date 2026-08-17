import axios from 'axios';
import * as cheerio from 'cheerio';
import { sleep, randomDelay } from './utils.js';

/**
 * 爬取详情页内容
 * @param {Array} announcements - 列表页爬取的公告数组
 * @returns {Promise<Array>} 包含详情页内容的公告数组
 */
export async function fetchAllDetails(announcements) {
  const results = [];

  console.log(`\n📖 开始爬取 ${announcements.length} 个详情页...`);

  for (let i = 0; i < announcements.length; i++) {
    const item = announcements[i];

    try {
      console.log(`  [${i + 1}/${announcements.length}] ${item.url}`);

      const html = await axios.get(item.url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }).then(r => r.data);

      const $ = cheerio.load(html);

      // 通用正文提取（按优先级尝试多个选择器）
      const contentSelectors = [
        '.article-content',
        '.content',
        '.detail-content',
        'article',
        '.main-content',
        '#content',
        '.TRS_Editor',
        '.Article',
      ];

      let content = '';
      for (const selector of contentSelectors) {
        const $content = $(selector);
        if ($content.length > 0 && $content.html().length > 200) {
          content = $content.html();
          break;
        }
      }

      // 如果没有找到标准容器，提取 body 主要部分
      if (!content || content.length < 200) {
        content = $('body').html();
      }

      results.push({
        ...item,
        rawHtml: content,  // 替换为详情页完整 HTML
      });

      // 礼貌爬取：随机延迟 1-3 秒
      if (i < announcements.length - 1) {
        await sleep(randomDelay(1000, 3000));
      }

    } catch (err) {
      console.error(`  ⚠️  详情页爬取失败: ${err.message}`);
      // 失败时保留原数据（列表页 HTML）
      results.push(item);
    }
  }

  console.log(`✅ 详情页爬取完成，成功 ${results.length} 个\n`);
  return results;
}
