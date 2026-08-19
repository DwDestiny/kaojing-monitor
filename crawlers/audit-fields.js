// 全量审计：examDate / examSubjects / examType 与原文对照
import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('./output/re-extracted-ollama.json', 'utf-8'));

// ===== 1. examDate 审计 =====
console.log('========== 1. examDate（15 条有值）对照 ==========');
let examDateChecked = 0;
for (const d of data) {
  if (!d.examDate) continue;
  const text = (d.rawHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  // 找"笔试时间"或"考试时间"附近的日期
  const m = text.match(/(?:笔试|考试)(?:时间|日期)?[：:为是]?\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/);
  examDateChecked++;
  const rawDate = m ? `${m[1] || (d.publishDate || '').slice(0, 4) || '2026'}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : null;
  const status = rawDate ? (rawDate === d.examDate ? '✅' : '⚠️') : '❓';
  console.log(`  ${status} ${d.title.slice(0, 28)} | 库=${d.examDate} | 原文笔试日=${rawDate || '未定位'}`);
}
console.log(`  （检查 ${examDateChecked} 条）`);

// ===== 2. examSubjects 审计 =====
console.log('\n========== 2. examSubjects（14 条有值）抽查 ==========');
let subjOk = 0, subjCheck = 0;
for (const d of data) {
  if (!d.examSubjects || !Array.isArray(d.examSubjects) || d.examSubjects.length === 0) continue;
  const text = (d.rawHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  subjCheck++;
  // 检查第一个科目是否出现在原文中
  const first = d.examSubjects[0];
  const found = text.includes(first.slice(0, 6));
  if (found) subjOk++;
  const status = found ? '✅' : '⚠️';
  console.log(`  ${status} ${d.title.slice(0, 28)} | 科目=${first.slice(0, 20)} | 原文含=${found}`);
}
console.log(`  （检查 ${subjCheck} 条，科目出现在原文 ${subjOk} 条）`);

// ===== 3. examType 抽样 =====
console.log('\n========== 3. examType 抽样对照（10 条）==========');
const typeSamples = data.filter(d => d.examType).slice(0, 10);
for (const d of typeSamples) {
  const title = d.title;
  const inTitle = ['事业单位', '公务员', '教师', '三支一扶', '医疗', '国企', '选调'].find(k => title.includes(k));
  const status = inTitle ? '✅' : '❓';
  console.log(`  ${status} 库=${d.examType} | 标题含=${inTitle || '(无明显关键词)'} | ${title.slice(0, 30)}`);
}

// ===== 4. publishDate 与 URL 中日期对照 =====
console.log('\n========== 4. publishDate 与 URL 日期一致性（抽查）==========');
const urlDateOk = data.filter(d => {
  const m = d.url.match(/20\d{2}[\/\-]\d{1,2}[\/\-]\d{1,2}/);
  return m && d.publishDate && m[0].replace(/\//g, '-') === d.publishDate;
}).length;
console.log(`  URL 含日期且与 publishDate 一致: ${urlDateOk}/${data.filter(d => d.url.match(/20\d{2}[\/\-]\d{1,2}[\/\-]\d{1,2}/) && d.publishDate).length} 条`);
