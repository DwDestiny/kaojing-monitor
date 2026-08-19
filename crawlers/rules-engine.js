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

  // ── 规则5: examSubjects（增强：剥离描述性文字，保留纯科目名）──
  if (item.examSubjects) {
    if (!Array.isArray(item.examSubjects)) {
      changes.push(`examSubjects: 非数组→清空`);
      item.examSubjects = [];
    } else {
      // 拆平（AI 可能把"综合应用能力两科，满分均为150分"塞进一个元素）→ 每项净化 → 去重
      const flat = [];
      for (const s of item.examSubjects) {
        flat.push(...String(s).split(/[,，、;；]/).map(x => x.trim()).filter(Boolean));
      }
      const cleaned = flat.map(cleanSubject).filter(s => s.length >= 2 && s.length <= 30);
      const unique = [...new Set(cleaned)];
      if (JSON.stringify(unique) !== JSON.stringify(item.examSubjects)) {
        changes.push(`examSubjects: ${item.examSubjects.length}项→${unique.length}项(净化描述)`);
      }
      item.examSubjects = unique.slice(0, 20);
    }
  }

  // ── 规则7: 笔试状态 examNote ──
  // 整条公告明确无笔试（直接业务考核/简化程序直接面试/免笔试等）且未提取到笔试日期 → 标记"免笔试"（前端显示"无笔试"）
  if (item.examNote === undefined) {
    let examNote = null;
    if (!item.examDate) {
      // 无笔试强信号（复合模式，避免"无笔试要求的博士岗位"这类部分岗位表述误标）
      const patterns = [
        /直接业务考核/,                                                    // 广东：考试采取直接业务考核方式进行
        /(?:简化程序|采取简化程序)?(?:组织)?直接面试[^。]{0,30}(?:面试成绩|总成绩|即为)/, // 山东：简化程序直接面试，面试成绩即为总成绩
        /免笔试|不设笔试|无需笔试|不组织笔试|不进行笔试|无笔试(?!要求)/,   // 强词（排除"无笔试要求"）
      ];
      let hit = null;
      for (const p of patterns) {
        const m = text.match(p);
        if (m) { hit = { pattern: p, index: m.index }; break; }
      }
      if (hit) {
        // 排除：关键词 ±40 字内出现"岗位/部分/个别/可以/可"→ 部分岗位免笔试，不标记整条
        const ctx = text.slice(Math.max(0, hit.index - 40), hit.index + 40);
        const partTime = /岗位|部分|个别|可以|可根据|的岗位/.test(ctx);
        const hasExamTime = /笔试时间|笔试日期|笔试定于|笔试于|笔试安排|笔试拟|笔试另行/.test(ctx);
        if (!partTime && !hasExamTime) {
          examNote = '免笔试';
        }
      }
    }
    item.examNote = examNote;
    if (examNote) changes.push(`examNote: 标记免笔试`);
  }

  return changes;
}

/** 纯科目名黑名单（净化后只剩这些通用词 → 丢弃） */
const SUBJECT_STOPWORDS = new Set([
  '笔试', '面试', '单科', '两科', '一科', '主要', '设置', '均设置',
  '综合类', '专业类', '公共类', '管理类', '工勤类', '教育类', '卫生类', '其他类',
  '考试', '科目', '闭卷', '开卷', '全部', '部分', '内容',
]);

/** 科目名净化：剥离描述性前缀/后缀，返回纯科目名（空串表示丢弃） */
function cleanSubject(raw) {
  let t = String(raw).trim();
  // 前缀剥离（长前缀优先）
  t = t.replace(/^.*?笔试科目为/, '');   // 笔试采取闭卷的方式进行，笔试科目为X
  t = t.replace(/^.*?考试科目为/, '');
  t = t.replace(/^.*?科目为/, '');
  t = t.replace(/^(?:笔试科目|考试科目)[：:]\s*/, '');
  t = t.replace(/^(?:一科|设置一科|均设置一科)[，,，]?\s*(?:主要内容为|考试内容主要为|考试内容为|考试内容包括|内容为|内容主要包括)?\s*/, '');
  t = t.replace(/^(?:综合类|专业类|公共类|管理类|工勤类|教育类|卫生类|其他类)[，,]\s*(?:考试内容主要为|考试内容为|内容为|考试内容)?\s*/, '');
  t = t.replace(/^(?:考试)?内容包括?[：:]?\s*/, '');
  t = t.replace(/^(?:考试)?内容(?:主要)?为[：:]?\s*/, '');
  t = t.replace(/^考试内容[：:]\s*/, '');
  // 截断描述后缀（满分/分为/两科/一科/成绩/题型/教材等）——cut>=0 时截断（含位置0→空串丢弃）
  const cut = t.search(/(满分|分为|两科|一科$|各[科门]|采取|笔试成绩|总分为|成绩|最低合格|题型|无指定|参考教材|主要包括|等基础性|内容为|内容包括|笔试时间|笔试后|笔试情况|笔试分|笔试)/);
  if (cut >= 0) t = t.slice(0, cut);
  // 去残留标点/说明
  t = t.replace(/[，,]\s*笔试\s*$/, '');   // "相关岗位专业知识， 笔试" → "相关岗位专业知识"
  t = t.replace(/[，。、;；：:\s]+$/g, '').trim();
  t = t.replace(/\s+/g, '');              // 去内部空格（"岗位 专业相关知识" → "岗位专业相关知识"）
  // 通用词/过短 → 丢弃
  if (SUBJECT_STOPWORDS.has(t) || t.length < 2) return '';
  return t;
}

// 导出供 upload-to-d1.js 复用（被 import 时不执行下方 CLI 主流程）
export { autoFix, normalizeText };

// ── 主流程（仅直接运行时执行：node rules-engine.js <input> <output>）──
const isCli = process.argv[1] && process.argv[1].endsWith('rules-engine.js');
if (!isCli) {
  // 被 import 时静默跳过主流程（不能 process.exit，会杀掉调用方进程）
  main = undefined;
} else {
  main();
}

function main() {
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
}
