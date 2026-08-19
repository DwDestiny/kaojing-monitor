// 批量对照 registrationDeadline 与原文报名截止日
import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('./output/re-extracted-ollama.json', 'utf-8'));
let checked = 0, match = 0, mismatch = 0, ambiguous = 0;
const mismatches = [];

for (const d of data) {
  if (!d.registrationDeadline) continue;
  const text = (d.rawHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  checked++;

  // 模式1: 报名时间：2026年8月18日12:00 至 8月24日18:00（提取"至"后的日期）
  // 模式2: 报名时间：2026年8月18日至8月24日
  // 模式3: 报名 X月X日—X月X日
  let found = null;
  // 优先：X年X月X日 ... 至 ... X年X月X日 或 至 X月X日
  const m3 = text.match(/报名[^。]{0,60}?至\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/);
  if (m3) {
    const year = m3[1] || (d.publishDate || '').slice(0, 4) || '2026';
    found = `${year}-${String(m3[2]).padStart(2, '0')}-${String(m3[3]).padStart(2, '0')}`;
  }
  // 模式2: 报名时间为X月X日至X月X日（无"至"前有年月，至后无年）
  if (!found) {
    const m2 = text.match(/报名[^。]{0,30}?(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号][^。]{0,20}至\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/);
    if (m2) {
      const year = m2[4] || m2[1];
      found = `${year}-${String(m2[5]).padStart(2, '0')}-${String(m2[6]).padStart(2, '0')}`;
    }
  }

  if (found) {
    if (found === d.registrationDeadline) {
      match++;
    } else {
      mismatch++;
      mismatches.push({ title: d.title.slice(0, 32), db: d.registrationDeadline, raw: found });
    }
  } else {
    ambiguous++;
  }
}

console.log('有 deadline 的条数:', checked);
console.log('原文可解析出截止日:', match + mismatch);
console.log('  与原文一致:', match);
console.log('  与原文不一致:', mismatch);
console.log('  原文无标准报名模式(无法验证):', ambiguous);
console.log('');
console.log('=== 不一致样本（前 12 条）===');
for (const m of mismatches.slice(0, 12)) {
  console.log(`  ${m.title} | 库=${m.db} | 原文截止=${m.raw}`);
}
