/**
 * 全字段数据审计（LLM 提取 + 校验层产物 vs 原文对照）
 * 用法：node audit-all.js
 * 输出：output/audit-report.json + 控制台摘要
 */
import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('./output/cleaned-data.json', 'utf-8'));

/** 归一化原文文本（同 rules-engine：去标签 + 压缩空白 + 数字-汉字空格修复 + 至/破折号归一） */
function textOf(item) {
  return (item.rawHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .replace(/\s*([年月日号])\s*/g, '$1')
    .replace(/\s*至\s*/g, '至')
    .replace(/\s*[-~—]\s*/g, '-');
}

const report = { total: data.length, checked: {}, issues: [] };
function issue(field, title, detail) {
  report.issues.push({ field, title: title.slice(0, 40), detail });
}

// ═══════ 1. deadline 对照（116 条有值）═══════
{
  const items = data.filter(d => d.registrationDeadline);
  report.checked.deadline = items.length;
  for (const d of items) {
    const text = textOf(d);
    const dl = d.registrationDeadline;
    // 原文找"报名X至Y"（第二日期年份为可选捕获组 m[4]，可能 undefined → 沿用第一日期年份）
    const m = text.match(/报名[^。]{0,60}?(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号][^。至\-—]{0,20}?(?:至|\-|—)\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/);
    if (m) {
      let y2 = m[4] || m[1];
      // 跨年（第二日期月份 < 第一日期月份）且未显式给年份 → +1 年
      if (!m[4] && parseInt(m[5]) < parseInt(m[2])) y2 = String(parseInt(m[1]) + 1);
      const end = `${y2}-${String(m[5]).padStart(2, '0')}-${String(m[6]).padStart(2, '0')}`;
      if (dl !== end) issue('deadline', d.title, `原文报名截止=${end}，库值=${dl} → 不一致`);
    } else {
      // 无标准区间：检查该日期是否在原文出现（防止无关日期幻觉）
      const dateStr = `${dl.slice(0, 4)}年${parseInt(dl.slice(5, 7))}月${parseInt(dl.slice(8, 10))}日`;
      const m2 = text.match(new RegExp(`${dateStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      if (!m2) {
        // 也可能是"至X月X日"（无年份）
        const md = dl.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (md) {
          const shortStr = `${parseInt(md[2])}月${parseInt(md[3])}日`;
          const m3 = text.match(new RegExp(shortStr));
          if (!m3) issue('deadline', d.title, `原文未找到 ${dateStr}/${shortStr}，库值=${dl}（无法验证）`);
        }
      }
    }
  }
}

// ═══════ 2. examDate 对照（24 条有值，全查）═══════
{
  const items = data.filter(d => d.examDate);
  report.checked.examDate = items.length;
  for (const d of items) {
    const text = textOf(d);
    const ed = d.examDate;
    const dateStr = `${ed.slice(0, 4)}年${parseInt(ed.slice(5, 7))}月${parseInt(ed.slice(8, 10))}日`;
    const shortStr = `${parseInt(ed.slice(5, 7))}月${parseInt(ed.slice(8, 10))}日`;
    // 笔试附近 100 字内是否出现该日期
    let ok = false;
    const penIdx = text.indexOf('笔试');
    if (penIdx >= 0) {
      const seg = text.slice(Math.max(0, penIdx - 30), penIdx + 120);
      ok = seg.includes(dateStr) || seg.includes(shortStr);
    } else {
      ok = text.includes(dateStr) || text.includes(shortStr);
    }
    if (!ok) issue('examDate', d.title, `原文笔试附近未找到 ${dateStr}，库值=${ed}`);
  }
}

// ═══════ 3. examType 与标题相关性（129 条有值，抽全部做弱对照）═══════
{
  const items = data.filter(d => d.examType);
  report.checked.examType = items.length;
  const kwMap = {
    '三支一扶': ['三支一扶', '基层项目', '支农', '支教', '支医'],
    '教师招聘': ['教师', '师范', '学院', '大学', '学校', '教育'],
    '医疗卫生': ['医院', '医疗', '卫生', '疾控', '医学', '康复', '保健'],
    '公务员': ['公务员', '选调生', '公考'],
    '选调生': ['选调'],
    '国企招聘': ['国企', '集团', '公司', '银行', '烟草', '电力'],
  };
  for (const d of items) {
    const t = d.examType;
    const title = d.title;
    if (t === '事业单位' || t === '其他') continue; // 宽泛类型跳过
    const kws = kwMap[t];
    if (kws && !kws.some(k => title.includes(k))) {
      issue('examType', title, `类型=${t} 与标题无明显关联`);
    }
  }
}

// ═══════ 4. recruitCount 对照（115 条有值，抽查式：找原文数字）═══════
{
  const items = data.filter(d => d.recruitCount != null);
  report.checked.recruitCount = items.length;
  for (const d of items) {
    const text = textOf(d);
    const n = d.recruitCount;
    // 原文找"招聘X人/计划招聘X名/共X人"等（允许 ±30% 偏差或精确匹配）
    const patterns = [
      new RegExp(`(?:招聘|招录|计划招聘|共招聘|拟招聘|面向社会公开招聘)[^。]{0,30}?${n}\\s*[人名额位]`),
      new RegExp(`${n}\\s*[人名额位](?:工作人员|人员|岗位)`),
    ];
    const hit = patterns.some(p => p.test(text));
    if (!hit) {
      // 可能是"1307个岗位1921人"这类（人数>岗位数）——宽松：任意 "X人" 且 X 接近
      const allNums = [...text.matchAll(/(\d{1,6})\s*人/g)].map(m => parseInt(m[1]));
      const near = allNums.filter(x => Math.abs(x - n) / n < 0.35);
      if (near.length === 0) issue('recruitCount', d.title, `原文未找到接近 ${n} 的人数（原文人数: ${allNums.slice(0, 5).join(',') || '无'}）`);
    }
  }
}

// ═══════ 5. examSubjects 对照（72 条有值，抽全部弱对照：科目名须出现在原文）═══════
{
  const items = data.filter(d => d.examSubjects && d.examSubjects.length);
  report.checked.examSubjects = items.length;
  for (const d of items) {
    const text = textOf(d);
    for (const s of d.examSubjects) {
      // 标准化后的科目可能不等于原文写法（如 公共基础知识 vs 公共基础知识），做包含检测
      const core = s.replace(/(知识|测验|测试|能力|基础)$/, '').slice(0, 6);
      if (core.length >= 3 && !text.includes(core)) {
        issue('examSubjects', d.title, `科目"${s}"（核心"${core}"）未在原文出现`);
      }
    }
  }
}

// ═══════ 6. examNote 免笔试（8 条全查：原文必须无笔试字样）═══════
{
  const items = data.filter(d => d.examNote === '免笔试');
  report.checked.examNote = items.length;
  for (const d of items) {
    const text = textOf(d);
    if (/(笔试内容|笔试时间|笔试科目|笔试地点|笔试成绩|笔试安排|笔试(?:于|定于))/.test(text)) {
      issue('examNote', d.title, '标记免笔试但原文存在笔试环节字样');
    }
  }
}

// ═══════ 7. examLocation（11 条全查）═══════
{
  const items = data.filter(d => d.examLocation);
  report.checked.examLocation = items.length;
  for (const d of items) {
    const text = textOf(d);
    const loc = d.examLocation;
    const core = loc.replace(/(考点|市|区|县|学校|学院|大学|中学)$/, '').slice(0, 4);
    if (core.length >= 3 && !text.includes(core)) {
      issue('examLocation', d.title, `地点"${loc}"未在原文出现`);
    }
  }
}

// 输出
writeFileSync('./output/audit-report.json', JSON.stringify(report, null, 2));
console.log(`总条数: ${report.total}`);
console.log('各字段抽查量:', JSON.stringify(report.checked));
console.log(`\n=== 发现问题: ${report.issues.length} 条 ===`);
const byField = {};
for (const i of report.issues) byField[i.field] = (byField[i.field] || 0) + 1;
console.log('按字段分布:', JSON.stringify(byField));
console.log('\n=== 明细 ===');
for (const i of report.issues) console.log(`[${i.field}] ${i.title}: ${i.detail}`);
