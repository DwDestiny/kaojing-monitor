/**
 * 批量源分析 → siteConfig 草案
 * 用法: node batch-analyze.mjs
 * 对候选源: 首页 → 找招考栏目 → 深度分析列表页 → 输出草案 JSON
 */
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const sources = [
  { id: 'shanghai_hrss', name: '上海市人力资源和社会保障局', region: '上海', home: 'https://rsj.sh.gov.cn/' },
  { id: 'zhejiang_hrss', name: '浙江省人力资源和社会保障厅', region: '浙江', home: 'https://rlsbt.zj.gov.cn/' },
  { id: 'sichuan_pta', name: '四川省人事考试中心', region: '四川', home: 'https://www.scpta.com.cn/' },
  { id: 'guizhou_hrss', name: '贵州省人力资源和社会保障厅', region: '贵州', home: 'https://rst.guizhou.gov.cn/' },
  { id: 'hunan_hrss', name: '湖南省人力资源和社会保障厅', region: '湖南', home: 'https://rst.hunan.gov.cn/' },
  { id: 'hubei_hrss', name: '湖北省人力资源和社会保障厅', region: '湖北', home: 'https://rst.hubei.gov.cn/' },
  { id: 'hebei_hrss', name: '河北省人力资源和社会保障厅', region: '河北', home: 'https://rst.hebei.gov.cn/' },
  { id: 'henan_hrss', name: '河南省人力资源和社会保障厅', region: '河南', home: 'https://hrss.henan.gov.cn/' },
  { id: 'yunnan_hrss', name: '云南省人力资源和社会保障厅', region: '云南', home: 'https://hrss.yn.gov.cn/' },
  { id: 'guangxi_pta', name: '广西人事考试院', region: '广西', home: 'https://www.gxpta.com.cn/' },
  { id: 'liaoning_pta', name: '辽宁人事考试网', region: '辽宁', home: 'https://www.lnrsks.com/' },
  { id: 'xinjiang_hrss', name: '新疆维吾尔自治区人力资源和社会保障厅', region: '新疆', home: 'https://rst.xinjiang.gov.cn/' },
  { id: 'heilongjiang_hrss', name: '黑龙江省人力资源和社会保障厅', region: '黑龙江', home: 'https://hrss.hlj.gov.cn/' },
  { id: 'jilin_hrss', name: '吉林省人力资源和社会保障厅', region: '吉林', home: 'https://hrss.jl.gov.cn/' },
  { id: 'shanxi_hrss', name: '山西省人力资源和社会保障厅', region: '山西', home: 'https://rst.shanxi.gov.cn/' },
  { id: 'inner_mongolia_hrss', name: '内蒙古自治区人力资源和社会保障厅', region: '内蒙古', home: 'https://rst.nmg.gov.cn/' },
  { id: 'hainan_hrss', name: '海南省人力资源和社会保障厅', region: '海南', home: 'https://hrss.hainan.gov.cn/' },
  { id: 'ningxia_pta', name: '宁夏人事考试中心', region: '宁夏', home: 'https://www.nxpta.com/' },
  { id: 'qgsydw', name: '全国事业单位招聘网', region: '全国', home: 'https://www.qgsydw.com/' },
  { id: 'chongqing_hrss', name: '重庆市人力资源和社会保障局', region: '重庆', home: 'https://rlsbj.cq.gov.cn/' },
];

const KEYWORDS = ['事业单位', '事业单位招聘', '招考', '通知公告', '公示公告'];

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
    clearTimeout(t);
    return res.ok ? await res.text() : null;
  } catch { clearTimeout(t); return null; }
}

async function findColumn(home) {
  const html = await fetchHtml(home);
  if (!html) return null;
  const cheerio = (await import('cheerio')).load(html);
  // 找关键词优先级的栏目链接
  for (const kw of KEYWORDS) {
    let best = null;
    let bestScore = 0;
    cheerio('a').each((_, el) => {
      const $a = cheerio(el);
      const text = $a.text().replace(/\s+/g, '').trim();
      const href = $a.attr('href') || '';
      if (!text || !href || href.startsWith('javascript') || href.startsWith('#')) return;
      // 排除文章页链接（/art/ 或具体 .html 文件），只保留栏目页（col/、index、目录结尾）
      if (/\/art\//.test(href) || /(?:index|list|default|t\d+)\.(?:html|shtml)$/.test(href) && text.length > 12) return;
      if (text.includes(kw)) {
        let score = text.length; // 越短越精准
        if (text === kw) score += 100;
        if (/sydw|zp/.test(href)) score += 50;
        if (/col\/|index|list/.test(href)) score += 30;
        if (score > bestScore) { bestScore = score; best = { text, href }; }
      }
    });
    if (best) {
      const abs = best.href.startsWith('http') ? best.href : new URL(best.href, home).href;
      return { ...best, url: abs };
    }
  }
  return null;
}

async function deepAnalyze(listUrl) {
  const html = await fetchHtml(listUrl);
  if (!html) return null;
  const cheerio = (await import('cheerio')).load(html);
  const pageTitle = cheerio('title').text().trim().slice(0, 50);

  // 候选容器评分
  const scored = [];
  cheerio('ul, table, div.list, div.news, ol').each((_, el) => {
    const $el = cheerio(el);
    const tag = el.tagName;
    const cls = ($el.attr('class') || '').slice(0, 50);
    const id = ($el.attr('id') || '').slice(0, 30);
    const $as = $el.find('a');
    const aCount = $as.length;
    if (aCount < 5) return;
    let score = aCount;
    score += $as.filter('[title]').length * 0.5;
    const hasDate = /20\d{2}[-/年]\d{1,2}[-/月]?\d{0,2}日?/.test($el.text());
    if (hasDate) score += 5;
    const direct = $el.children('li').length || $el.children('tr').length;
    scored.push({ tag, cls, id, aCount, hasDate, direct, score });
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return { pageTitle, err: 'no container', container: null, itemCount: 0, hasDate: false, firstItem: { text: '', title: '', href: '', dateSelector: null }, pagination: null, sampleHtml: '' };

  const container = `${best.tag}${best.id ? '#' + best.id : ''}${best.cls ? '.' + best.cls.split(' ').join('.') : ''}`;
  const $c = cheerio(container);
  const $first = $c.find('li, tr').first();
  const $a = $first.find('a').first();
  const href = $a.attr('href') || '';
  const aTitle = $a.attr('title') || '';
  const aText = $a.text().trim().slice(0, 50);
  // 日期元素
  let dateSel = null;
  $first.find('span, em, i, font, td').each((_, s) => {
    const t = cheerio(s).text().trim();
    if (!dateSel && /^20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/.test(t)) {
      const tag = s.tagName;
      const cls = cheerio(s).attr('class');
      dateSel = cls ? `${tag}.${cls.split(' ').join('.')}` : tag;
    }
  });
  // 分页
  let pagination = null;
  cheerio('a').each((_, el) => {
    const t = cheerio(el).text().trim();
    const h = cheerio(el).attr('href') || '';
    if (!pagination && /(index|list)_\d+\.(html|shtml)/.test(h)) {
      pagination = { type: 'static-file', pattern: h.replace(/\d+\.(html|shtml)$/, '{page}.$1') };
    }
  });

  return {
    pageTitle, container, itemCount: best.direct || best.aCount, hasDate: best.hasDate,
    firstItem: { text: aText, title: aTitle, href, dateSelector: dateSel },
    pagination,
    sampleHtml: cheerio.html($first).replace(/\s+/g, ' ').slice(0, 260),
  };
}

const results = [];
for (const s of sources) {
  console.log(`\n▶ ${s.id} (${s.name})`);
  const col = await findColumn(s.home);
  if (!col) { console.log('  未找到栏目'); results.push({ id: s.id, ok: false, reason: 'no column found' }); continue; }
  console.log(`  栏目: ${col.text} → ${col.url}`);
  const analysis = await deepAnalyze(col.url);
  if (!analysis) { console.log('  列表页抓取失败'); results.push({ id: s.id, ok: false, reason: 'list fetch fail', column: col.url }); continue; }
  console.log(`  容器: ${analysis.container || '-'} | 条目: ${analysis.itemCount ?? 0} | 日期: ${analysis.firstItem?.dateSelector || '无'} | ${analysis.err || 'ok'}`);
  console.log(`  首条: ${analysis.firstItem?.text || ''}${analysis.firstItem?.title ? ' [' + analysis.firstItem.title + ']' : ''} ${(analysis.firstItem?.href || '').slice(0, 60)}`);
  if (analysis.pagination) console.log(`  分页: ${analysis.pagination.type} ${analysis.pagination.pattern}`);
  results.push({
    id: s.id, name: s.name, region: s.region, ok: true,
    columnText: col.text, columnUrl: col.url,
    ...analysis,
  });
  await new Promise(r => setTimeout(r, 1200)); // 礼貌间隔
}

writeFileSync(new URL('./batch-analyze-results.json', import.meta.url), JSON.stringify(results, null, 2));
const ok = results.filter(r => r.ok);
console.log(`\n=== 完成: ${ok.length}/${results.length} 成功 ===`);
ok.forEach(r => console.log(`  ✅ ${r.id} ${r.container} ${r.firstItem.dateSelector ? 'date=' + r.firstItem.dateSelector : ''} ${r.pagination ? 'PG' : '1P'}`));
