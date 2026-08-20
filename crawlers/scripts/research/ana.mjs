// 分析本地 HTML 文件中的栏目链接
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
const file = process.argv[2];
const pattern = new RegExp(process.argv[3] || '事业单位|公务员|招聘');
const $ = load(readFileSync(file, 'utf8'));
const seen = new Set();
$('a').each((i, el) => {
  const t = $(el).text().trim().replace(/\s+/g, '');
  const h = $(el).attr('href') || '';
  if (pattern.test(t) && h && h !== '#' && !/javascript:/.test(h) && t.length < 40) {
    const k = t + '|' + h;
    if (!seen.has(k)) { seen.add(k); console.log(t.slice(0, 30), '→', h); }
  }
});
