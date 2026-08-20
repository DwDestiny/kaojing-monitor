/**
 * 全源列表抓取验证（不调 AI，纯 selector 验证）
 * 用法: node scripts/test-lists.mjs [源id...]
 */
import { readFileSync } from 'node:fs';
import { crawl } from '../core/engine.js';

const config = JSON.parse(readFileSync('./config/sites.json', 'utf-8'));
const filterIds = process.argv.slice(2);
const sites = config.sites.filter(s => s.enabled && (filterIds.length === 0 || filterIds.includes(s.id)));

console.log(`验证 ${sites.length} 个启用源...\n`);

const results = [];
for (const site of sites) {
  const t0 = Date.now();
  try {
    const items = await crawl(site, { maxPages: site.paginationType === 'single' ? 1 : 1 });
    const valid = items.filter(i => i.title && i.url && i.url.startsWith('http'));
    const withDate = valid.filter(i => /^\d{4}-\d{2}-\d{2}$/.test(i.publishDate || ''));
    results.push({ id: site.id, name: site.name, total: items.length, valid: valid.length, dateRate: withDate.length, ms: Date.now() - t0, titles: valid.slice(0, 3).map(i => i.title) });
    console.log(`${'✅'.padEnd(4)} ${site.id.padEnd(20)} 抓取 ${items.length} 条 / 有效 ${valid.length} / 带日期 ${withDate.length} / ${Date.now() - t0}ms`);
    valid.slice(0, 3).forEach(t => console.log(`      · ${t.title.slice(0, 48)} [${t.publishDate || '无日期'}]`));
  } catch (e) {
    results.push({ id: site.id, name: site.name, total: 0, valid: 0, dateRate: 0, ms: Date.now() - t0, error: e.message });
    console.log(`${'❌'.padEnd(4)} ${site.id.padEnd(20)} 失败: ${e.message.slice(0, 80)}`);
  }
  // 礼貌间隔
  await new Promise(r => setTimeout(r, 800));
}

const ok = results.filter(r => r.valid >= 1);
const bad = results.filter(r => r.valid === 0);
console.log(`\n=== 汇总: ${ok.length}/${results.length} 源有效抓取 ===`);
if (bad.length) {
  console.log('失败源:');
  bad.forEach(b => console.log(`  ❌ ${b.id} ${b.error || '0 条有效'}`));
}
