/**
 * 审计修复脚本：应用 LLM 审计 + 人工复核结论（精确修复，按标题匹配）
 * 修复项：
 * 1. deadline 回填（LLM 审计确认值）
 * 2. examType 补标（省属事业单位公告）
 * 3. recruitCount 回填（岗位人数求和）
 * 4. examSubjects 补充（多岗位科目/专业名称精确化）
 * 5. examNote 精确修正（人工复核分类）
 */
import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('./output/cleaned-data.json', 'utf-8'));
const log = [];
const find = k => data.find(x => x.title.includes(k));

function set(titleKey, field, value, reason) {
  const d = find(titleKey);
  if (!d) { log.push(`⚠ 未找到: ${titleKey}`); return; }
  const old = JSON.stringify(d[field]);
  d[field] = value;
  log.push(`✓ ${titleKey.slice(0, 26)} .${field}: ${old} → ${JSON.stringify(value)} (${reason})`);
}

// ── 1. deadline 回填 ──
set('山东师范大学附属小学2026年第二批', 'registrationDeadline', '2026-04-30', 'LLM审计：报名至4月30日16:00');
set('烟台大学2026年公开招聘', 'registrationDeadline', '2026-04-22', 'LLM审计：报名截止4月22日');
set('山东城市建设职业学院2026年公开招聘人员', 'registrationDeadline', '2026-10-31', 'LLM审计：长期博士岗报名有效期至10月31日');
// 教育厅直属已由区间回填恢复 03-13（rules-engine），无需手动

// ── 2. examType 补标 ──
set('山东省交通科学研究院2026年度公开招聘', 'examType', '事业单位', 'LLM审计：省属事业单位公开招聘');
set('山东省中医药研究院2026年度公开招聘', 'examType', '事业单位', 'LLM审计：省属事业单位公开招聘');

// ── 3. recruitCount 回填（岗位求和）──
set('山东师范大学附属小学2026年第二批', 'recruitCount', 14, 'LLM审计：初级1+中级13=14');
set('烟台大学2026年公开招聘', 'recruitCount', 17, 'LLM审计：总人数17');

// ── 4. examSubjects 补充/精确化 ──
set('山东第一医科大学第一附属医院（山东省千佛山医院）', 'examSubjects',
  ['公共基础知识', '医学专业基础知识', '护理专业基础知识'],
  'LLM审计：综合/医疗/护理三类考试内容精确化');
set('山东师范大学2026年公开招聘人员', 'examSubjects', ['专业知识'], 'LLM审计：笔试测试相关理论知识和职业素养→专业知识');
set('山东师范大学附属小学2026年第二批', 'examSubjects', ['专业知识'], 'LLM审计：相关理论知识和职业素养→专业知识');
set('山东中医药大学第二附属医院2026年第二批', 'examSubjects', ['专业知识'], 'LLM审计：笔试测试理论、专业知识');
set('山东航空学院2026年公开招聘人员', 'examSubjects',
  ['时事政治', '公共基础知识', '高校教师岗位相关知识', '辅导员职业能力相关知识'],
  'LLM审计：辅导员+教师岗位科目合并去重');

// ── 5. examNote 人工复核修正 ──
// A 类确认保留（已在名单）：林业科研/国土测绘/地质科研/海洋资源/生态修复/眼科医院/健康医疗大数据/慢性病/工信/法官培训/立第三医院/妇幼博士高级/公共卫生临床/疾控/水利科研/海河淮河/工程咨询院/孔子研究院/农大
// B 类确认不标（若 LLM 直出误标，强制置 null）：
set('青岛酒店管理职业技术学院2026年公开招聘人员', 'examNote', null, '人工复核：副高级和高技能人才岗位可采取=部分岗位');
set('山东省康复研究中心2026年公开招聘人员', 'examNote', null, '人工复核：高级专业技术人员招聘的岗位可采取=部分岗位');
set('山东中医药大学第二附属医院2026年公开招聘人员', 'examNote', null, '人工复核：面向高级、博士招聘的岗位=部分岗位');

writeFileSync('./output/cleaned-data.json', JSON.stringify(data, null, 2));
console.log('===== 审计修复明细 =====');
for (const l of log) console.log(l);
console.log('\n总修改:', log.length);
