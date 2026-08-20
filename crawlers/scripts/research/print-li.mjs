// 打印文件中所有含"招聘/公告/公示"文本的 li/a 及其结构
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
const file = process.argv[2];
const $ = load(readFileSync(file, 'utf8'));
$('li').each((i, el) => {
  const $li = $(el);
  const t = $li.text().trim().replace(/\s+/g, ' ');
  if (/招聘|公告|公示|简章|招考/.test(t) && t.length > 8) {
    const $a = $li.find('a').first();
    console.log(`LI[${i}] cls=${$li.attr('class') || ''} | ${t.slice(0, 70)} | href=${$a.attr('href') || ''}`);
  }
});
console.log('--- 带日期的li ---');
$('li').each((i, el) => {
  const $li = $(el);
  const t = $li.text().trim().replace(/\s+/g, ' ');
  const d = t.match(/20\d{2}[-/年]\d{1,2}/);
  if (d && t.length < 120) console.log(`LI[${i}] cls=${$li.attr('class') || ''} | ${t.slice(0, 70)} | 日期=${d[0]}`);
});
