/**
 * 存量 examTime 语境校验（规则7.5，2026-08-20）
 * 导出 exam_time 非空记录（含 raw_html）→ 检测"咨询时间/报名时间"语境 → 输出 UPDATE SQL
 * 用法：cd api && node ../crawlers/scripts/fix-examtime-context.mjs
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { normalizeText } from '../rules-engine.js';

const out = execSync(
  './node_modules/.bin/wrangler d1 execute kaojing-db --remote --json --command "SELECT id, title, exam_time, exam_note, raw_html FROM announcements WHERE exam_time IS NOT NULL AND length(exam_time) > 0"',
  { cwd: process.cwd(), encoding: 'utf-8' }
);

const parsed = JSON.parse(out.match(/\[[\s\S]*\]/)[0]);
const rows = parsed[0]?.results || [];
console.log(`导出 exam_time 非空记录: ${rows.length} 条`);

const updates = [];
for (const r of rows) {
  const et = String(r.exam_time || '');
  const raw = String(r.raw_html || '');
  const text = normalizeText(raw.replace(/<[^>]+>/g, ' '));
  const etEscaped = et.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ctxRe = new RegExp(`(咨询时间|报名时间)[^。；;]{0,80}${etEscaped}`, 'i');
  const isConsulting = ctxRe.test(text);
  const isWholeNoExam = r.exam_note === '免笔试' && et;
  if (isConsulting || isWholeNoExam) {
    updates.push({ id: r.id, et, reason: isConsulting ? '咨询/报名时间' : '免笔试无笔试时间' });
    console.log(`  ⚠ id=${r.id} ${et} → 清除(${isConsulting ? '咨询/报名时间' : '免笔试'}) | ${String(r.title).slice(0, 30)}`);
  }
}

if (updates.length > 0) {
  const sql = updates.map(u => `UPDATE announcements SET exam_time = NULL WHERE id = ${u.id};`).join('\n');
  const outPath = new URL('../output/fix-examtime-context.sql', import.meta.url).pathname;
  writeFileSync(decodeURIComponent(outPath), sql + '\n', 'utf-8');
  console.log(`\nSQL 已写入: ${decodeURIComponent(outPath)}（${updates.length} 条）`);
} else {
  console.log('无需更新');
}
