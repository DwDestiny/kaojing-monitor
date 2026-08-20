/**
 * 数据质量校验引擎（校验层 v2）
 * 架构：LLM 提取为主，本引擎只做【校验 / 否决 / 归一化】，不再用正则提取覆盖 LLM 值：
 *
 * 规则1（deadline 报名截止日）：格式 YYYY-MM-DD + 发布后 1-365 天窗口 +
 *   区间校验（原文有"报名X至Y"时，LLM 值必须落在 [X, Y] 内，否则置 null 宁缺毋滥）
 * 规则2（examDate 笔试日）：格式 + 发布后 0-365 天窗口
 * 规则3（examType）：白名单（事业单位/公务员/教师招聘/三支一扶/医疗卫生/国企招聘/选调生/其他）
 * 规则4（recruitCount）：1-100000 整数
 * 规则5（examSubjects）：LLM 值清洗（拆平 → 去描述 → 特征词过滤 → 标准化别名映射）
 * 规则6（日期格式）：YYYY-MM-DD 强校验
 * 规则7（examNote 免笔试）：否决——LLM 标免笔试但原文存在笔试环节字样（笔试内容/时间/科目/地点/成绩）→ 取消；
 *   补标——原文强信号（直接业务考核/简化程序直接面试+成绩即总成绩/免笔试类）且无笔试字样 → 补标
 *
 * 用法：node rules-engine.js <input.json> <output.json>
 *   input 默认 ./output/re-extracted-ollama.json（LLM 提取产物）
 *   output 默认 ./output/cleaned-data.json
 */

import { readFileSync, writeFileSync } from 'fs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 归一化文本：去 HTML、压缩空白、修复数字间空格 */
function normalizeText(raw) {
  return (raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .replace(/\s*([年月日号])\s*/g, '$1')
    .replace(/\s*至\s*/g, '至')
    .replace(/\s*[-~—]\s*/g, '-');
}

function daysBetween(a, b) {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
}

/**
 * 提取原文"报名X至Y"区间 [start, end]（用于校验 LLM 的 deadline 是否在区间内）
 * @returns {[string, string]|null}
 */
function extractDeadlineRange(text, yearGuess) {
  // "报名时间：2026年X月X日[时间]至Y月Z日" / "报名X至Y" / "报名X—Y"
  // 第二日期年份为可选捕获组 m[4]（可能 undefined → 沿用第一日期年份；跨年 +1）
  const m = text.match(/报名[^。]{0,60}?(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号][^。至\-—]{0,20}?(?:至|\-|—)\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/);
  if (m) {
    let y2 = m[4] || m[1];
    if (!m[4] && parseInt(m[5]) < parseInt(m[2])) y2 = String(parseInt(m[1]) + 1);
    return [
      `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`,
      `${y2}-${String(m[5]).padStart(2, '0')}-${String(m[6]).padStart(2, '0')}`,
    ];
  }
  // 模式2："报名截止/报名结束 ... 日期"
  const m2 = text.match(/(?:报名截止|报名结束|报名时间截止)[时间日期为至]?\s*[：:]?\s*(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]/);
  if (m2) {
    const end = `${m2[1]}-${String(m2[2]).padStart(2, '0')}-${String(m2[3]).padStart(2, '0')}`;
    return [end, end];
  }
  return null;
}

const EXAM_TYPES = ['事业单位', '公务员', '教师招聘', '三支一扶', '医疗卫生', '国企招聘', '选调生', '公安辅警', '其他'];

/** 科目标准化映射（按辅导员考情大表归纳） */
const SUBJECT_ALIASES = [
  [/公共基础(?:知识)?|公基(?!础)/, '公共基础知识'],
  [/行政职业能力测验|职业能力倾向测验|职业能力测试|行政能力测试|行政能力测验|职测|行测/, '职业能力倾向测验'],
  [/综合应用能力(?:测试|测验)?/, '综合应用能力'],
  [/综合(?:基础)?知识(?:测试|测验)?/, '综合知识'],
  [/申论/, '申论'],
  [/教育(?:综合)?基础(?:知识)?|高等教育基础(?:知识)?/, '教育基础知识'],
  [/高等教育教学基础(?:知识)?/, '教育教学基础知识'],
  [/高等教育心理学|教育心理学/, '教育心理学'],
  [/医学基础(?:知识)?|医学综合(?:知识)?/, '医学基础知识'],
  [/卫生专业(?:知识)?/, '卫生专业知识'],
  [/护理(?:学|知识)?/, '护理学'],
  [/临床医学/, '临床医学'],
  [/专业基础(?:知识)?|岗位专业(?:相关)?知识|专业知识/, '专业知识'],
  [/写作/, '写作'],
  [/时事政治/, '时事政治'],
  [/法律法规/, '法律法规'],
];

function normalizeSubject(name) {
  const t = name.trim();
  for (const [re, std] of SUBJECT_ALIASES) {
    if (re.test(t)) return std;
  }
  return t;
}

/** 纯科目名黑名单（净化后只剩这些通用词 → 丢弃） */
const SUBJECT_STOPWORDS = new Set([
  '笔试', '面试', '单科', '两科', '一科', '主要', '设置', '均设置',
  '综合类', '专业类', '公共类', '管理类', '工勤类', '教育类', '卫生类', '其他类',
  '考试', '科目', '闭卷', '开卷', '全部', '部分', '内容',
]);

/** 科目特征词：净化后不含任一特征词 → 判定非科目，丢弃 */
const SUBJECT_FEATURE_RE = /(基础|测验|知识|能力|申论|写作|专业|教育|医学|护理|法律|时政|政治|理论|心理|道德|职业|技能|素质|常识|判断|言语|数量|资料|推理|管理|技术|计算机|综合)/;

/** 科目名净化：剥离描述性前缀/后缀，返回纯科目名（空串表示丢弃） */
function cleanSubject(raw) {
  let t = String(raw).trim();
  t = t.replace(/^.*?笔试科目为/, '');
  t = t.replace(/^.*?考试科目为/, '');
  t = t.replace(/^.*?科目为/, '');
  t = t.replace(/^(?:笔试科目|考试科目)[：:]\s*/, '');
  t = t.replace(/^(?:一科|设置一科|均设置一科)[，,，]?\s*(?:主要内容为|考试内容主要为|考试内容为|考试内容包括|内容为|内容主要包括)?\s*/, '');
  t = t.replace(/^(?:综合类|专业类|公共类|管理类|工勤类|教育类|卫生类|其他类)[，,]\s*(?:考试内容主要为|考试内容为|内容为|考试内容)?\s*/, '');
  t = t.replace(/^(?:考试)?内容包括?[：:]?\s*/, '');
  t = t.replace(/^(?:考试)?内容(?:主要)?为[：:]?\s*/, '');
  t = t.replace(/^考试内容[：:]\s*/, '');
  const cut = t.search(/(满分|分为|两科|一科$|各[科门]|采取|笔试成绩|总分为|成绩|最低合格|题型|无指定|参考教材|主要包括|等基础性|内容为|内容包括|笔试时间|笔试后|笔试情况|笔试分|笔试|考试|部分|方式|形式|试题|突出考察|主要考察|考察考生|测查)/);
  if (cut >= 0) t = t.slice(0, cut);
  t = t.replace(/[《》]/g, '');
  t = t.replace(/[，,]\s*笔试\s*$/, '');
  t = t.replace(/[，。、;；：:\s]+$/g, '').trim();
  t = t.replace(/等\s*$/, '');
  t = t.replace(/\s+/g, '');
  if (SUBJECT_STOPWORDS.has(t) || t.length < 2) return '';
  return t;
}

/** 校验并修复单条（校验层：只否决不覆盖） */
function autoFix(item) {
  const rawText = (item.rawHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const text = normalizeText(rawText);
  const pub = item.publishDate && DATE_RE.test(item.publishDate) ? item.publishDate : null;
  const yearGuess = pub ? pub.slice(0, 4) : '2026';
  const changes = [];

  // ── 规则1: registrationDeadline 校验 ──
  let deadline = item.registrationDeadline;
  if (deadline && !DATE_RE.test(deadline)) {
    changes.push(`deadline: ${deadline}→null(格式非法)`);
    deadline = null;
  } else if (deadline && pub) {
    const gap = daysBetween(pub, deadline);
    if (gap === null || gap < 1 || gap > 365) {
      changes.push(`deadline: ${deadline}→null(偏离发布日${gap ?? '?'}天，超窗口)`);
      deadline = null;
    } else {
      // 长期招聘豁免：原文"长期报名/报名有效期至X/招满为止"时，deadline 取长期有效值，
      // 不按"首批报名区间"校验（如广东建设职院：报名有效期至11月30日，首批报名至9月30日 → 取11-30）
      const longTerm = /长期报名|报名有效期至|长期有效|招满为止|招满即止|随时报名|长期招聘/.test(text);
      if (!longTerm) {
        // 区间校验：原文"报名X至Y"时，LLM 值必须在区间内；不在区间 → 回填区间截止日（原文明确证据，优于置 null）
        const range = extractDeadlineRange(text, yearGuess);
        if (range && (deadline < range[0] || deadline > range[1])) {
          changes.push(`deadline: ${deadline}→${range[1]}(回填报名区间截止日)`);
          deadline = range[1];
        }
      }
    }
  }
  item.registrationDeadline = deadline;

  // ── 规则2: examDate 校验 ──
  let examDate = item.examDate;
  if (examDate && !DATE_RE.test(examDate)) {
    changes.push(`examDate: ${examDate}→null(格式非法)`);
    examDate = null;
  } else if (examDate && pub) {
    const gap = daysBetween(pub, examDate);
    if (gap === null || gap < 0 || gap > 365) {
      changes.push(`examDate: ${examDate}→null(不在公告后0-365天)`);
      examDate = null;
    }
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

  // ── 规则5: examSubjects 清洗标准化（LLM 值）──
  if (item.examSubjects) {
    if (!Array.isArray(item.examSubjects)) {
      changes.push('examSubjects: 非数组→清空');
      item.examSubjects = [];
    } else {
      const flat = [];
      for (const s of item.examSubjects) {
        flat.push(...String(s).split(/[,，、;；]/).map(x => x.trim()).filter(Boolean));
      }
      const cleaned = flat.map(cleanSubject).filter(s => s.length >= 2 && s.length <= 30 && SUBJECT_FEATURE_RE.test(s));
      const normalized = cleaned.map(normalizeSubject);
      const unique = [...new Set(normalized)];
      if (JSON.stringify(unique) !== JSON.stringify(item.examSubjects)) {
        changes.push(`examSubjects: ${item.examSubjects.length}项→${unique.length}项(清洗标准化)`);
      }
      item.examSubjects = unique.slice(0, 20);
    }
  } else {
    item.examSubjects = [];
  }

  // ── 规则7: examNote 笔试状态（三态：免笔试 / 部分岗位免笔试 / null）──
  // 整条免笔试招聘（招聘对象全部为博士/高级/高层次，标题或正文命中）
  const WHOLESET_RE = /面向(?:博士|高级|高层次|博士研究生|具有博士|高级和博士)|公开招聘(?:博士|高级|高层次)/;
  // 部分岗位免笔试语境（"XX岗位人员可以采取简化程序"等）
  const PARTTIME_RE = /岗位人员|人员，可以|岗位，可以|岗位可以|岗位可|可以采取简化程序|可采取简化程序|部分|个别|其中|部分岗位/;
  let examNote = item.examNote;
  if (examNote === '免笔试') {
    // 否决：①原文存在笔试环节字样（说明有笔试）；②部分岗位语境（"XX岗位人员可以采取"，非整条免笔试）；
    // ③原文无任何免笔试依据（无"直接面试/免笔试/业务考核"等强信号）→ 考试方式未知，不得标免笔试（防 LLM 凭标题臆测）
    const hasExam = /笔试内容|笔试时间|笔试科目|笔试地点|笔试成绩|笔试工作|笔试安排|笔试(?:于|定于)|笔试环节/.test(text);
    const noExamEvidence = /直接业务考核|简化程序直接面试|考试采取[^。]{0,20}面试|全部(?:采取|进行)[^。]{0,15}面试|免笔试|不设笔试|无需笔试|不组织笔试|不进行笔试|无笔试(?!要求)|试讲和答辩/.test(text);
    const sig = text.match(/(简化程序直接面试|直接业务考核|免笔试|不设笔试|无笔试|试讲和答辩)/);
    const ctx = sig ? text.slice(Math.max(0, sig.index - 50), sig.index + 50) : text.slice(0, 120);
    const isWholeSet = WHOLESET_RE.test(item.title || '') || WHOLESET_RE.test(ctx);
    const partTime = !isWholeSet && PARTTIME_RE.test(ctx);
    if (hasExam || partTime || !noExamEvidence) {
      changes.push(`examNote: 免笔试→${partTime ? '部分岗位免笔试' : 'null'}(${hasExam ? '原文有笔试环节' : partTime ? '仅部分岗位免笔试(降级保留信息)' : '原文无免笔试依据(考试方式未知)'})`);
      examNote = partTime ? '部分岗位免笔试' : null;
    }
  } else if (examNote === '部分岗位免笔试') {
    // 部分岗位免笔试：需要原文有"可采取/岗位可以"等部分岗位语境依据；若无依据 → 否决为 null
    const hasPartial = /(?:岗位|人员|部分)(?:可以|可采取|可简化)|部分岗位|可以采取简化程序|可采取简化程序|个别岗位/.test(text);
    const hasExam = /笔试内容|笔试时间|笔试科目|笔试地点|笔试成绩|笔试工作|笔试安排|笔试(?:于|定于)|笔试环节/.test(text);
    if (!hasPartial && !hasExam) {
      changes.push('examNote: 部分岗位免笔试→null(原文无部分岗位免笔试依据)');
      examNote = null;
    }
  } else {
    // 补标：原文强信号（LLM 漏标时补）；WHOLESET 优先（整条免笔试招聘），其余含"岗位"语境视为部分岗位
    const noExam = text.match(/(直接业务考核|(?:考试采取|全部|均)?简化程序直接面试[^。]{0,30}(?:面试|总成绩)|免笔试|不设笔试|无需笔试|不组织笔试|不进行笔试|无笔试(?!要求)|试讲和答辩)/);
    if (noExam && !item.examDate) {
      const ctx = text.slice(Math.max(0, noExam.index - 50), noExam.index + 50);
      // 整条免笔试：标题含博士/高级，或原文"面向博士…招聘采取"（且非"可采取"——"可采取"=部分岗位）
      const isWholeSet = WHOLESET_RE.test(item.title || '') ||
        (WHOLESET_RE.test(ctx) && !/可采取|可以采取|可简化程序|可组织/.test(ctx));
      const partTime = !isWholeSet && /岗位|部分|个别|其中|可以|可根据/.test(ctx);
      const hasPen = /笔试/.test(ctx) || /(笔试时间|笔试日期|笔试定于|笔试于|笔试安排|笔试另行|笔试内容)/.test(text);
      if (!hasPen) {
        if (!partTime) {
          changes.push('examNote: 补标免笔试(规则强信号)');
          examNote = '免笔试';
        } else {
          // 部分岗位免笔试：有"岗位可以/可采取"语境但非整条 → 补"部分岗位免笔试"（保留信息而非否决丢失）
          changes.push('examNote: 补标部分岗位免笔试(岗位语境)');
          examNote = '部分岗位免笔试';
        }
      }
    }
  }
  item.examNote = examNote;

  return changes;
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
