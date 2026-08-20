/**
 * 列表页深度分析 → siteConfig 草案
 * 用法: node deep-analyze.mjs <listUrl> [容器CSS提示]
 * 输出: 容器/条目/标题/日期 selector + 分页模式 + 第一条目 HTML 样例 + 建议 siteConfig
 */
const [listUrl, containerHint] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
    clearTimeout(t);
    return res.ok ? await res.text() : null;
  } catch (e) { clearTimeout(t); return null; }
}

const cheerioMod = await import('cheerio');
const cheerio = cheerioMod.load ? cheerioMod : cheerioMod.default;
const $ = cheerio.load((await fetchHtml(listUrl)) || '<html></html>');

const title = $('title').text().trim().slice(0, 50);
console.log(`列表页: ${listUrl}`);
console.log(`页面标题: ${title}`);

// 1. 找到含链接+日期的候选容器
const scores = [];
$('ul, table, div.list, div.zp, div.news, ol').each((_, el) => {
  const $el = $(el);
  const tag = el.tagName;
  const cls = ($el.attr('class') || '').slice(0, 50);
  const id = ($el.attr('id') || '').slice(0, 30);
  const $as = $el.find('a');
  const aCount = $as.length;
  if (aCount < 5) return;
  // 评分：链接带 title 属性 +1，容器内有日期文本 +2
  let score = aCount;
  const withTitle = $as.filter('[title]').length;
  score += withTitle * 0.5;
  const hasDate = /20\d{2}[-/年]\d{1,2}[-/月]?\d{0,2}日?/.test($el.text());
  if (hasDate) score += 5;
  const direct = $el.children('li').length || $el.children('tr').length;
  scores.push({ tag, cls, id, aCount, withTitle, hasDate, direct, score });
});
scores.sort((a, b) => b.score - a.score);
console.log('\n候选容器 Top5:');
scores.slice(0, 5).forEach(s =>
  console.log(`  ${s.tag}${s.id ? '#' + s.id : ''}${s.cls ? '.' + s.cls : ''}  a=${s.aCount} title=${s.withTitle} date=${s.hasDate} direct=${s.direct} score=${s.score}`));

const best = scores[0];
if (!best) { console.log('未找到合适容器'); process.exit(0); }

// 2. 输出最佳容器前 3 条目结构
const container = `${best.tag}${best.id ? '#' + best.id : ''}${best.cls ? '.' + best.cls.split(' ').join('.') : ''}`;
const $c = $(container);
console.log(`\n最佳容器: ${container}`);
$c.find('li, tr').slice(0, 3).each((i, el) => {
  const $li = $(el);
  const $a = $li.find('a').first();
  const href = $a.attr('href') || '';
  const aTitle = $a.attr('title') || '';
  const aText = $a.text().trim().slice(0, 50);
  // 找日期
  const dateMatch = $li.text().match(/20\d{2}[-/年]\d{1,2}[-/月]?\d{0,2}日?/);
  const dateSpan = $li.find('span, em, i, font').filter((_, s) => /20\d{2}/.test($(s).text())).first();
  console.log(`  [${i}] <a href="${href}" title="${aTitle}">${aText}</a> | 日期文本: ${dateMatch ? dateMatch[0] : '无'} | 日期元素: ${dateSpan.length ? '<' + dateSpan[0].tagName + (dateSpan.attr('class') ? '.' + dateSpan.attr('class') : '') + '>' + dateSpan.text().trim() : '无'}`);
  // 打印紧凑 HTML
  console.log(`      HTML: ${$.html($li).replace(/\s+/g, ' ').slice(0, 300)}`);
});

// 3. 分页模式检测
console.log('\n分页链接:');
let pg = '';
$('a').each((_, el) => {
  const t = $(el).text().trim();
  const href = $(el).attr('href') || '';
  if (/^(下一页|下页|2|下一页|>|»|末页)/.test(t) && href) {
    pg = `${t} → ${href}`;
  }
  if (/index_\d+\.(html|shtml)/.test(href) && !pg.includes(href)) {
    pg = `静态分页 → ${href}`;
  }
});
console.log('  ' + (pg || '未检测到明确分页（可能 JS/单页）'));

// 4. 生成 siteConfig 草案
console.log('\n=== siteConfig 草案 ===');
const itemSel = best.direct >= 5 ? `${container} > li, ${container} > tr` : `${container} li, ${container} tr`;
console.log(JSON.stringify({
  listPageUrl: listUrl,
  paginationType: pg.includes('静态分页') ? 'static-file' : (pg ? 'url-param' : 'single'),
  paginationPattern: pg.includes('静态分页') ? 'index_{page}.html' : null,
  maxPages: 2,
  containerSelector: container,
  itemSelector: 'li,tr',
  titleSelector: 'a',
  titleAttr: null,
  urlSelector: 'a',
  urlAttr: 'href',
  dateSelector: null,
}, null, 2));
