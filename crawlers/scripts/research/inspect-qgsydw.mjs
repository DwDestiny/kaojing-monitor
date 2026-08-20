import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
const file = process.argv[2];
const $ = load(readFileSync(file, 'utf8'));
const li = $('li').filter((i, el) => $(el).find('a[href*="insrecruit/20"]').length > 0);
console.log('公告条目li数:', li.length);
console.log('--- 单个条目HTML ---');
console.log($.html(li.first()).replace(/\s+/g, ' ').slice(0, 700));
console.log('--- 分页链接 ---');
const pages = [];
$('a').each((i, el) => {
  const t = $(el).text().trim();
  const h = $(el).attr('href') || '';
  if (/下一页|末页|共.*页|^[0-9]{1,3}$/.test(t) && h) pages.push(t + ' → ' + h);
});
console.log(pages.slice(0, 25).join('\n') || '无');
console.log('--- insrecruit列表区容器 ---');
const firstA = $('a[href*="insrecruit/20"]').first();
console.log('父链:', firstA.parents().map((i, el) => el.tagName + '.' + ($(el).attr('class') || '') + ($(el).attr('id') ? '#' + $(el).attr('id') : '')).get().join(' < '));
