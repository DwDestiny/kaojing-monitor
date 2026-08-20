import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
const file = process.argv[2];
const $ = load(readFileSync(file, 'utf8'));
const items = $('ul.uli14 li');
console.log('ul.uli14 条目数:', items.length);
items.slice(0, 5).each((i, el) => {
  const a = $(el).find('a').first();
  const t = $(el).find('span.time').text().trim() || $(el).find('span').last().text().trim();
  console.log(' ', (a.attr('title') || a.text().trim()).slice(0, 45), '|', a.attr('href'), '| time:', t);
  console.log('   HTML:', $.html(el).replace(/\s+/g, ' ').slice(0, 220));
});
console.log('--- 分页链接 ---');
$('a').each((i, el) => {
  const t = $(el).text().trim();
  const h = $(el).attr('href') || '';
  if (/下一页|末页|上一页|首页|共.*页|^[0-9]{1,3}$/.test(t) && h) console.log(t + ' → ' + h);
});
console.log('--- 页脚/共N页文本 ---');
const bodyText = $('body').text();
const m = bodyText.match(/共\s*(\d+)\s*页|当前第\s*(\d+)\s*页/);
console.log(m ? `共${m[1] || '?'}页 当前第${m[2] || '?'}页` : '未找到共N页文本');
