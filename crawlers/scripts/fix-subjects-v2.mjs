/**
 * 存量科目二次归并（P1C 长尾归并，2026-08-20）
 * 用法（在 api 目录执行，读线上 D1）：
 *   node ../crawlers/scripts/fix-subjects-v2.mjs
 * 流程：导出线上 exam_subjects → normalizeSubject 归并 → 输出 UPDATE SQL 到 output/fix-subjects-v2.sql
 * 执行：wrangler d1 execute kaojing-db --remote --file=../crawlers/output/fix-subjects-v2.sql
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { normalizeSubject } from '../rules-engine.js';

const out = execSync(
  './node_modules/.bin/wrangler d1 execute kaojing-db --remote --json --command "SELECT id, exam_subjects FROM announcements"',
  { cwd: process.cwd(), encoding: 'utf-8' }
);

let rows = [];
try {
  const parsed = JSON.parse(out);
  // wrangler --json 返回 { results: [...] } 或 [{results:...}]
  rows = parsed.results || (Array.isArray(parsed) && parsed[0]?.results) || [];
} catch (e) {
  console.error('导出解析失败:', e.message.slice(0, 100));
  process.exit(1);
}

console.log(`导出 ${rows.length} 条含科目记录`);

const updates = [];
let changed = 0;
for (const r of rows) {
  const raw = String(r.exam_subjects || '');
  if (!raw.trim()) continue;
  const items = raw.split(',').map(s => s.trim()).filter(Boolean);
  const normalized = [...new Set(items.map(normalizeSubject))];
  const joined = normalized.join(',');
  if (joined !== raw.trim()) {
    updates.push({ id: r.id, old: raw, new: joined });
    changed++;
  }
}

console.log(`需更新 ${changed} 条（含长尾科目）`);

if (updates.length > 0) {
  const sql = updates.map(u =>
    `UPDATE announcements SET exam_subjects = '${u.new.replace(/'/g, "''")}' WHERE id = ${u.id};`
  ).join('\n');
  const outPath = new URL('../output/fix-subjects-v2.sql', import.meta.url).pathname;
  writeFileSync(decodeURIComponent(outPath), sql + '\n', 'utf-8');
  console.log(`SQL 已写入: ${decodeURIComponent(outPath)}`);

  // 预览：归并前后科目分布
  const before = new Map();
  const after = new Map();
  for (const r of rows) {
    for (const s of String(r.exam_subjects || '').split(',').map(x => x.trim()).filter(Boolean)) {
      before.set(s, (before.get(s) || 0) + 1);
    }
  }
  for (const r of rows) {
    const items = String(r.exam_subjects || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const s of new Set(items.map(normalizeSubject))) {
      after.set(s, (after.get(s) || 0) + 1);
    }
  }
  console.log(`\n=== 归并前 ${before.size} 种 ===`);
  console.log([...before].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${v}x ${k}`).join('\n'));
  console.log(`\n=== 归并后 ${after.size} 种 ===`);
  console.log([...after].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${v}x ${k}`).join('\n'));
} else {
  console.log('无需更新');
}
