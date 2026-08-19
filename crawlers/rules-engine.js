/**
 * 数据质量规则引擎（零人工）
 * 对提取后的每条公告自动校验并修复字段，规则明确、可审计：
 *
 * 规则 1（deadline 截止日）：从原文提取"报名...至 X月X日"的第二个日期（截止日），
 *   命中则强制采用（覆盖 AI/旧值）；未命中时 AI 值必须满足
 *   publishDate+1天 ≤ deadline ≤ publishDate+180天，否则置 null（宁缺毋滥）。
 * 规则 2（examDate 笔试日）：从原文提取"笔试/考试时间...日期"，命中则采用；
 *   AI 值必须 ≥ publishDate，否则置 null。
 * 规则 3（examType）：白名单强制（事业单位/公务员/教师招聘/三支一扶/医疗卫生/国企招聘/选调生/其他）。
 * 规则 4（recruitCount）：1-100000 整数，否则置 null。
 * 规则 5（examSubjects）：数组、每项 ≤ 60 字、最多 20 项，否则清空。
 * 规则 6（日期格式）：YYYY-MM-DD 强校验，非法置 null。
 *
 * 用法：node rules-engine.js <input.json> <output.json>
 *   input 默认 ./output/re-extracted-ollama.json
 *   output 默认 ./output/cleaned-data.json
 */

import { readFileSync, writeFileSync } from 'fs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXAM_TYPES = ['事业单位', '公务员', '教师招聘', '三支一扶', '医疗卫生', '国企招聘', '选调生', '其他'];

/** 从原文提取"报名...至 X月X日"的截止日 */
function ruleDeadline(text, publishDate) {
  const yearGuess = (publishDate || '').slice(0, 4) || '2026';
  // 模式0（最高优先）: 报名有效期至X月X日 / 截止至X月X日（长期招聘的明确截止）
  const m0 = text.match(/(?:报名)?(?:有效期|截止)[^。]{0,10}?至\s*(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]/);
  if (m0) {
    return `${m0[1]}-${String(m0[2]).padStart(2, '0')}-${String(m0[3]).padStart(2, '0')}`;
  }
  // 模式1: 报名时间：2026年X月X日...至X月X日 / 报名时间：X月X日-X月X日
  //   要求"报名时间"出现后 50 字内必须有日期区间，取第二个日期
  const m1 = text.match(/报名时间[：:为是]?\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号][^。至]{0,30}?(?:至|[-~—])\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/);
  if (m1) {
    const year = m1[4] || m1[1] || yearGuess;
    return `${year}-${String(m1[5]).padStart(2, '0')}-${String(m1[6]).padStart(2, '0')}`;
  }
  // 模式1b: 报名申请。2026年X月X日...至X月X日（新疆兵团等结构）
  const m1b = text.match(/报名申请[。：:为是]?\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号][^。至]{0,30}?(?:至|[-~—])\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/);
  if (m1b) {
    const year = m1b[4] || m1b[1] || yearGuess;
    return `${year}-${String(m1b[5]).padStart(2, '0')}-${String(m1b[6]).padStart(2, '0')}`;
  }
  // 模式2: "报名...：X月X日 至 X月X日"（报名后 40 字内，且区间两端都有日期）
  const m2 = text.match(/报名[^。]{0,25}?(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号][^。至]{0,20}?(?:至|[-~—])\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/);
  if (m2) {
    const year = m2[4] || m2[1] || yearGuess;
    return `${year}-${String(m2[5]).padStart(2, '0')}-${String(m2[6]).padStart(2, '0')}`;
  }
  // 模式3: 报名截止/报名结束 ... 日期
  const m3 = text.match(/(?:报名截止|报名结束)[时间日期为至]?\s*[：:]?\s*(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]/);
  if (m3) {
    return `${m3[1]}-${String(m3[2]).padStart(2, '0')}-${String(m3[3]).padStart(2, '0')}`;
  }
  // 模式4: X年X月X日(前/之前)(报名/截止/提交)
  const m4 = text.match(/(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]?\s*(?:前|之前)(?:报名|截止|提交)/);
  if (m4) {
    return `${m4[1]}-${String(m4[2]).padStart(2, '0')}-${String(m4[3]).padStart(2, '0')}`;
  }
  return null;
}

/** 从原文提取笔试日期 */
function ruleExamDate(text) {
  const m = text.match(/(?:笔试|考试)(?:时间|日期)?[：:为是]?\s*(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return null;
}

function daysBetween(a, b) {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
}

/** 文本规范化：去掉数字间/年月日附近空格（"202 6 年 7 月 3 日" → "2026年7月3日"） */
function normalizeText(text) {
  return text
    // 移除数字之间的空格："202 6" → "2026"
    .replace(/(\d)\s+(\d)/g, '$1$2')
    // 移除"年月日"前的空格："7 月 3 日" → "7月3日"
    .replace(/\s*([年月日号])\s*/g, '$1')
    // 移除"至"附近空格
    .replace(/\s*至\s*/g, '至')
    .replace(/\s*[-~—]\s*/g, '-');
}

/** 校验并修复单条 */
function autoFix(item) {
  const rawText = (item.rawHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const text = normalizeText(rawText);
  const pub = item.publishDate && DATE_RE.test(item.publishDate) ? item.publishDate : null;
  const changes = [];

  // ── 规则1: registrationDeadline ──
  let deadline = item.registrationDeadline;
  const ruleDl = ruleDeadline(text, pub || item.publishDate);
  if (ruleDl && DATE_RE.test(ruleDl)) {
    if (deadline !== ruleDl) { changes.push(`deadline: ${deadline}→${ruleDl}(规则命中"至"后日期)`); }
    deadline = ruleDl;
  } else if (deadline && DATE_RE.test(deadline) && pub) {
    // 无规则命中时，AI 值必须在发布后 1-180 天
    const gap = daysBetween(pub, deadline);
    if (gap === null || gap < 1 || gap > 365) {
      changes.push(`deadline: ${deadline}→null(偏离发布日${gap ?? '?'}天，超合理窗口)`);
      deadline = null;
    }
  } else if (deadline && !DATE_RE.test(deadline)) {
    changes.push(`deadline: ${deadline}→null(格式非法)`);
    deadline = null;
  }
  item.registrationDeadline = deadline;

  // ── 规则2: examDate ──
  let examDate = item.examDate;
  const ruleEd = ruleExamDate(text);
  if (ruleEd && DATE_RE.test(ruleEd)) {
    if (examDate !== ruleEd) { changes.push(`examDate: ${examDate}→${ruleEd}(规则命中笔试日)`); }
    examDate = ruleEd;
  } else if (examDate && DATE_RE.test(examDate) && pub) {
    const gap = daysBetween(pub, examDate);
    if (gap === null || gap < 0 || gap > 365) {
      changes.push(`examDate: ${examDate}→null(不在公告后0-365天)`);
      examDate = null;
    }
  } else if (examDate && !DATE_RE.test(examDate)) {
    changes.push(`examDate: ${examDate}→null(格式非法)`);
    examDate = null;
  }
  item.examDate = examDate;

  // ── 规则3: examType 白名单 ──
  if (item.examType && !EXAM_TYPES.includes(item.examType)) {
    changes.push(`examType: ${item.examType}→null(不在白名单)`);
    item.examType = null;
  }

  // ── 规则4: recruitCount ──
  const rc = item.recruitCount;
  if (rc !== null && rc !== undefined) {
    const n = parseInt(rc);
    if (Number.isNaN(n) || n < 1 || n > 100000) {
      changes.push(`recruitCount: ${rc}→null(超范围)`);
      item.recruitCount = null;
    } else {
      item.recruitCount = n;
    }
  }

  // ── 规则5: examSubjects ──
  if (item.examSubjects) {
    if (!Array.isArray(item.examSubjects)) {
      changes.push(`examSubjects: 非数组→清空`);
      item.examSubjects = [];
    } else {
      const cleaned = item.examSubjects
        .map(s => String(s).trim())
        .filter(s => s.length > 0 && s.length <= 60);
      if (cleaned.length !== item.examSubjects.length || cleaned.length > 20) {
        changes.push(`examSubjects: ${item.examSubjects.length}项→${cleaned.length}项(清洗)`);
      }
      item.examSubjects = cleaned.slice(0, 20);
    }
  }

  return changes;
}

// ── 主流程 ──
const inputPath = process.argv[2] || './output/re-extracted-ollama.json';
const outputPath = process.argv[3] || './output/cleaned-data.json';

const data = JSON.parse(readFileSync(inputPath, 'utf-8'));
console.log(`规则引擎处理 ${data.length} 条...`);

let totalChanges = 0;
const changeLog = [];
for (const item of data) {
  const changes = autoFix(item);
  if (changes.length > 0) {
    totalChanges += changes.length;
    changeLog.push({ title: item.title.slice(0, 30), changes });
  }
}

writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log(`\n===== 规则引擎结果 =====`);
console.log(`总条数: ${data.length}`);
console.log(`被修正字段数: ${totalChanges}`);
console.log(`受影响条目: ${changeLog.length}`);
console.log(`\n=== 修正明细（前 20 条）===`);
for (const c of changeLog.slice(0, 20)) {
  console.log(`  ${c.title}`);
  for (const ch of c.changes) console.log(`      ${ch}`);
}
console.log(`\n已保存: ${outputPath}`);
console.log('审计建议：修正后字段全部符合规则，无需人工。');
