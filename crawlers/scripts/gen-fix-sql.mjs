/**
 * 根据审计报告生成存量修复 SQL
 * 输入: /tmp/kj-full-report.json（审计 FAIL 明细）
 * 输出: crawlers/output/fix-audit-20260820.sql + 校验失败清单
 * 校验: 日期格式/人数正整数/类型白名单/examNote 三态/科目数组
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const report = JSON.parse(readFileSync('/tmp/kj-full-report.json', 'utf-8'));
const details = report.details;

const EXAM_TYPES = ['事业单位', '公务员', '教师招聘', '三支一扶', '医疗卫生', '国企招聘', '选调生', '公安辅警', '其他'];
const EXAM_NOTES = ['免笔试', '部分岗位免笔试', null];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{1,2}[:：]\d{2}\s*[-~至到]\s*\d{1,2}[:：]\d{2})(\s*[,，;；]\s*\d{1,2}[:：]\d{2}\s*[-~至到]\s*\d{1,2}[:：]\d{2})*$/;

const fixes = {};   // id -> { field: value }
const rejected = []; // 校验失败待人工

function normDate(v) {
  if (v === null || v === undefined || v === '') return null;
  // "2026-04-25和2026-04-26" 双日期 → 取第一个（或拆开？这里取列表页主日期第一个）
  const m = String(v).match(/\d{4}-\d{2}-\d{2}/g);
  return m ? m[0] : null;
}

for (const d of details) {
  const { id, field, value } = d;
  const expected = value && value.expected;
  if (expected === undefined) continue; // 无期望值（如某些 reason-only）
  if (!fixes[id]) fixes[id] = {};
  const f = fixes[id];

  switch (field) {
    case 'publishDate':
    case 'examDate':
    case 'registrationDeadline': {
      const v = normDate(expected);
      if (expected !== null && expected !== undefined && expected !== '' && !v) {
        rejected.push({ id, field, expected: JSON.stringify(expected), reason: '日期格式无法解析' });
        continue;
      }
      f[field] = v;
      break;
    }
    case 'recruitCount': {
      if (expected === null || expected === undefined || expected === '') { f[field] = null; break; }
      const n = Number(expected);
      if (!Number.isInteger(n) || n <= 0) {
        rejected.push({ id, field, expected: JSON.stringify(expected), reason: '人数非正整数' });
        continue;
      }
      f[field] = n;
      break;
    }
    case 'examType': {
      if (expected && !EXAM_TYPES.includes(expected)) {
        rejected.push({ id, field, expected, reason: '类型不在白名单' });
        continue;
      }
      f[field] = expected || null;
      break;
    }
    case 'examNote': {
      if (expected !== null && expected !== '免笔试' && expected !== '部分岗位免笔试') {
        rejected.push({ id, field, expected: JSON.stringify(expected), reason: 'examNote 非法值' });
        continue;
      }
      // 安全规则：期望为 null（清空免笔试标记）的修改一律跳过待人工复核——
      // 审计曾漏读原文（吉林 9028 原文"考试采取免笔试的方式进行"被 LLM 判"未提及免笔试"）
      if (expected === null) {
        rejected.push({ id, field, expected: 'null', reason: 'examNote 清空类修改需人工复核（审计有漏读案例）' });
        continue;
      }
      f[field] = expected;
      break;
    }
    case 'examSubjects': {
      let arr = Array.isArray(expected) ? expected : (expected ? String(expected).split(/[,，、;；]+/) : []);
      arr = arr.map(s => s.trim()).filter(Boolean);
      f[field] = arr.length ? arr.join(',') : null;
      break;
    }
    case 'examTime': {
      if (expected === null || expected === undefined || expected === '') { f[field] = null; break; }
      const v = String(expected).replace(/[：]/g, ':').trim();
      if (!TIME_RE.test(v)) {
        rejected.push({ id, field, expected: v, reason: '时间格式异常' });
        continue;
      }
      f[field] = v;
      break;
    }
    case 'examLocation': {
      if (expected === null || expected === undefined || expected === '') { f[field] = null; break; }
      const v = String(expected).trim();
      if (v.length > 100) { f[field] = v.slice(0, 100); } else { f[field] = v; }
      break;
    }
    default:
      rejected.push({ id, field, expected: JSON.stringify(expected), reason: '未知字段' });
  }
}

// 字段映射（camelCase → D1 snake_case 列名）
const COL_MAP = {
  publishDate: 'publish_date',
  examDate: 'exam_date',
  registrationDeadline: 'registration_deadline',
  recruitCount: 'recruit_count',
  examType: 'exam_type',
  examNote: 'exam_note',
  examSubjects: 'exam_subjects',
  examTime: 'exam_time',
  examLocation: 'exam_location',
};

// 生成 SQL
const lines = [];
const ids = Object.keys(fixes);
for (const id of ids) {
  const fieldEntries = Object.entries(fixes[id]);
  if (fieldEntries.length === 0) continue; // 所有修改被安全规则跳过（如 examNote 清空类）→ 不生成空 UPDATE
  const sets = [];
  for (const [col, val] of fieldEntries) {
    const dbCol = COL_MAP[col];
    if (!dbCol) {
      rejected.push({ id, field: col, expected: JSON.stringify(val), reason: '未知字段映射' });
      continue;
    }
    if (val === null || val === undefined || val === '') {
      sets.push(`${dbCol} = NULL`);
    } else if (typeof val === 'number') {
      sets.push(`${dbCol} = ${val}`);
    } else {
      // 转义单引号
      const esc = String(val).replace(/'/g, "''");
      sets.push(`${dbCol} = '${esc}'`);
    }
  }
  lines.push(`UPDATE announcements SET ${sets.join(', ')} WHERE id = ${id};`);
}

const sql = lines.join('\n') + '\n';
mkdirSync('./output', { recursive: true });
const outPath = './output/fix-audit-20260820.sql';
writeFileSync(outPath, sql, 'utf-8');
console.log('=== 修复 SQL 生成 ===');
console.log('涉及记录:', ids.length, '条');
console.log('校验拒绝(需人工):', rejected.length, '条');
if (rejected.length) {
  console.log('--- 拒绝清单 ---');
  rejected.slice(0, 20).forEach(r => console.log(`id=${r.id} [${r.field}] ${r.reason}: ${r.expected}`));
}
console.log('SQL 已写入:', outPath);
// 输出字段变更统计
const colStat = {};
ids.forEach(id => Object.keys(fixes[id]).forEach(c => colStat[c] = (colStat[c] || 0) + 1));
console.log('字段变更统计:', JSON.stringify(colStat));
