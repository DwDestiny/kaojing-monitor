/**
 * 列表页结构分析工具
 * 用法: node analyze-list.mjs <homeUrl> <关键词>
 * 抓取首页 → 找包含关键词的栏目链接 → 抓栏目页 → 输出列表结构分析
 */
import { writeFileSync } from 'node:fs';

const [home, keyword = '事业单位'] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' } });
    clearTimeout(t);
    if (!res.ok) return { status: res.status, text: '' };
    return { status: res.status, text: await res.text() };
  } catch (e) {
    clearTimeout(t);
    return { status: 0, text: '', err: e.message.slice(0, 80) };
  }
}

// 用 cheerio 从 HTML 中找链接
async function findLinks(html, base) {
  // 动态 import cheerio（crawlers 里有装）
  const cheerio = await import('cheerio');
  const $ = cheerio.load(html);
  const links = [];
  $('a').each((_, el) => {
    const $a = $(el);
    const text = $a.text().replace(/\s+/g, ' ').trim();
    const href = $a.attr('href') || '';
    if (text && text.length <= 40 && text.includes(keyword)) {
      links.push({ text, href });
    }
  });
  // 去重 + 限制
  const seen = new Set();
  const out = [];
  for (const l of links) {
    const k = l.href + '|' + l.text;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
    if (out.length >= 15) break;
  }
  return out;
}

async function analyzeList(url, label) {
  const { status, text, err } = await fetchHtml(url);
  if (!text) { console.log(`  [${label}] status=${status} err=${err || 'empty'}`); return null; }
  const cheerio = await import('cheerio');
  const $ = cheerio.load(text);
  const title = $('title').text().trim().slice(0, 60);
  // 找所有 <ul> 下的 <li><a> 模式，统计最可能的列表容器
  const candidates = [];
  $('ul, div.list, div.news-list, table').each((_, el) => {
    const $el = $(el);
    const tag = el.tagName;
    const cls = ($el.attr('class') || '').slice(0, 40);
    const items = $el.find('li, a[href]').length;
    if (items >= 5) candidates.push({ tag, cls, items });
  });
  // 取前 8 个候选容器
  const top = candidates.sort((a, b) => b.items - a.items).slice(0, 8);
  console.log(`\n== [${label}] ${url} ==`);
  console.log(`  title: ${title}`);
  console.log(`  htmlLen: ${text.length}`);
  console.log(`  候选容器:`);
  top.forEach(c => console.log(`    ${c.tag}.${c.cls || '-'} (${c.items} items)`));
  // 抓第一条列表项的 HTML 结构
  let sample = '';
  $('li').each((_, el) => {
    const $li = $(el);
    const $a = $li.find('a').first();
    const href = $a.attr('href') || '';
    if ($a.text().trim() && href && !sample) {
      sample = $.html($li).slice(0, 400);
    }
  });
  if (sample) console.log(`  条目样例: ${sample.replace(/\n/g, ' ')}`);
  return { title, url, html: text };
}

(async () => {
  console.log(`抓取首页: ${home}`);
  const { status, text } = await fetchHtml(home);
  if (!text) { console.log('首页抓取失败', status); return; }
  const links = await findLinks(text, home);
  console.log(`\n含"${keyword}"的栏目链接 (${links.length}):`);
  links.forEach(l => console.log(`  ${l.text} → ${l.href}`));
  // 取前 5 个栏目链接做列表分析
  const base = new URL(home).origin;
  for (const l of links.slice(0, 5)) {
    const abs = l.href.startsWith('http') ? l.href : new URL(l.href, base + '/').href;
    await analyzeList(abs, l.text.slice(0, 16));
  }
})();
