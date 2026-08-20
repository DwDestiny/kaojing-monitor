/**
 * 全量数据规则级异常扫描（第一步：筛可疑，第二步 LLM 对照原文定案）
 * 输入: /tmp/kj-all.json（线上全量）
 * 输出: 可疑记录清单（分维度），写入 /tmp/kj-anomalies.json
 */
import { readFileSync, writeFileSync } from 'fs';

const all = JSON.parse(readFileSync('/tmp/kj-all.json', 'utf-8'));
const suspicious = [];
const dims = {};

function flag(id, title, dim, desc) {
  suspicious.push({ id, title, dim, desc });
  dims[dim] = (dims[dim] || 0) + 1;
}

const TIME_OK = /^\d{1,2}[:：]\d{2}\s*[-~至到]\s*\d{1,2}[:：]\d{2}$/;

for (const a of all) {
  const t = a.title || '';
  const pub = a.publishDate || '';
  const examDate = a.examDate || '';
  const examTime = a.examTime || '';
  const deadline = a.registrationDeadline || '';
  const note = a.examNote || '';
  const count = a.recruitCount;
  const subjects = Array.isArray(a.examSubjects) ? a.examSubjects
    : (typeof a.examSubjects === 'string' && a.examSubjects ? a.examSubjects.split(/[,，、;；\s]+/).filter(Boolean) : []);
  const type = a.examType || '';
  const subjText = subjects.join(' ');

  // 1. 免笔试但带日期/时间（逻辑矛盾）
  if (note === '免笔试') {
    if (examDate) flag(a.id, t, 'mianbi_date', `免笔试却带 examDate=${examDate}`);
    if (examTime) flag(a.id, t, 'mianbi_time', `免笔试却带 examTime=${examTime}`);
  }
  if (note === '部分岗位免笔试' && examTime && !TIME_OK.test(examTime)) {
    flag(a.id, t, 'parttime_time', `部分免笔试带异常 examTime=${examTime}`);
  }

  // 2. examTime 含非时间字样（直接暴露幻觉）
  if (examTime && /[咨询报名工作日下午至前年月日星期]/.test(examTime)) {
    flag(a.id, t, 'time_text', `examTime 含语境字样: ${examTime}`);
  }
  // 3. examTime 格式异常
  if (examTime && !TIME_OK.test(examTime) && !/[点时]/.test(examTime)) {
    flag(a.id, t, 'time_format', `examTime 格式异常: ${examTime}`);
  }

  // 4. examDate 早于 publishDate
  if (examDate && pub && examDate < pub) {
    flag(a.id, t, 'date_before_pub', `examDate=${examDate} 早于 publishDate=${pub}`);
  }
  // 5. deadline 早于 publishDate
  if (deadline && pub && deadline < pub) {
    flag(a.id, t, 'deadline_before_pub', `deadline=${deadline} 早于 publishDate=${pub}`);
  }
  // 6. examDate 与 publishDate 差 > 240 天（笔试一般公告后数月内）
  if (examDate && pub) {
    const days = (new Date(examDate) - new Date(pub)) / 86400000;
    if (days > 240) flag(a.id, t, 'examdate_far', `examDate=${examDate} 距发布 ${Math.round(days)} 天`);
  }
  // 7. deadline 超长窗口 > 400 天
  if (deadline && pub) {
    const days = (new Date(deadline) - new Date(pub)) / 86400000;
    if (days > 400) flag(a.id, t, 'deadline_far', `deadline=${deadline} 距发布 ${Math.round(days)} 天`);
  }

  // 8. recruitCount 异常
  if (count === null || count === undefined || count === 0) {
    flag(a.id, t, 'count_empty', '招聘人数为空或 0');
  } else if (typeof count === 'number' && (count < 0 || count > 3000)) {
    flag(a.id, t, 'count_weird', `recruitCount=${count}`);
  }

  // 9. 标题含结果类词（漏网的结果公示）
  if (/(公示|拟聘|拟录用|成绩|体检|考察结果|递补|聘用名单|资格复审结果)/.test(t)) {
    flag(a.id, t, 'result_title', `标题疑似结果类: ${t.slice(0, 50)}`);
  }

  // 10. 科目含描述性文字
  if (subjects.some(s => /满分|两科|一科|三科|占比|考试方式|闭卷|客观题|主观题|分{1,2}$/.test(s))) {
    flag(a.id, t, 'subject_desc', `科目含描述: ${subjText.slice(0, 80)}`);
  }

  // 11. examType 与标题关键词不匹配
  const kw = {
    '公务员': /公务员|省考|国考/,
    '三支一扶': /三支一扶/,
    '教师招聘': /教师|师范|中小学|幼儿园|高校公开招聘/,
    '医疗卫生': /医院|卫生|医疗|疾控|卫生院|护理|医师/,
    '公安辅警': /辅警|警务辅助/,
    '选调生': /选调/,
    '国企招聘': /集团|有限公司|国企|控股公司|股份有限公司/,
  };
  for (const [tname, re] of Object.entries(kw)) {
    if (re.test(t) && type !== tname) {
      flag(a.id, t, 'type_mismatch', `标题含"${tname}"关键词但 examType=${type || 'null'}`);
    }
  }

  // 12. examDate 为文字（另行通知等）
  if (examDate && !/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(examDate)) {
    flag(a.id, t, 'examdate_text', `examDate 非日期: ${examDate}`);
  }
  // 13. deadline 非日期
  if (deadline && !/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(deadline)) {
    flag(a.id, t, 'deadline_text', `deadline 非日期: ${deadline}`);
  }
}

// 去重（同 id 多维度）只保留一次但合并维度
const byId = {};
for (const s of suspicious) {
  if (!byId[s.id]) byId[s.id] = { id: s.id, title: s.title, dims: [], descs: [] };
  byId[s.id].dims.push(s.dim);
  byId[s.id].descs.push(s.desc);
}
const dedup = Object.values(byId);

console.log('=== 扫描结果 ===');
console.log('总记录:', all.length, '| 可疑记录:', dedup.length, '| 可疑维度数:', suspicious.length);
console.log('\n=== 分维度统计 ===');
Object.entries(dims).sort((a, b) => b[1] - a[1]).forEach(([d, c]) => console.log(String(c).padEnd(4), d));
writeFileSync('/tmp/kj-anomalies.json', JSON.stringify(dedup, null, 2));
console.log('\n清单已写 /tmp/kj-anomalies.json');
