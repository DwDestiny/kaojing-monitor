// 检查列表页中的真实公告条目
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
const file = process.argv[2];
const $ = load(readFileSync(file, 'utf8'));
// 找所有含日期的 li 及父容器
const scores = [];
$('ul, table, div.list, div.zp, div.news, ol').each((_, el) => {
  const $el = $(el);
  const tag = el.tagName;
  const cls = ($el.attr('class') || '').slice(0, 60);
  const id = ($el.attr('id') || '').slice(0, 40);
  const $as = $el.find('a');
  const aCount = $as.length;
  if (aCount < 3) return;
  const text = $el.text();
  const dateMatch = text.match(/20\d{2}-\d{1,2}-\d{1,2}/g);
  const titleMatch = text.match(/招聘|招考|公告|简章/g);
  scores.push({
    tag, cls, id, aCount,
    hasDate: dateMatch ? dateMatch.length : 0,
    hasTitle: titleMatch ? titleMatch.length : 0,
    dateSample: dateMatch ? dateMatch.slice(0, 3) : [],
    firstHref: $as.first().attr('href') || '',
  });
});
scores.sort((a, b) => (b.hasDate * 3 + b.hasTitle) - (a.hasDate * 3 + a.hasTitle));
console.log('候选容器(按日期权重):');
scores.slice(0, 8).forEach(s => console.log(JSON.stringify(s)));
