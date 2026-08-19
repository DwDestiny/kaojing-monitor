/**
 * fix-subjects.js — 科目精修
 * 针对 LLM 审计标记的科目问题样本（漏提取/不完整/术语不精确），
 * 用强化提示词单独重提 examSubjects，替换后写回 cleaned-data.json。
 *
 * 用法：OLLAMA_API_KEY=xxx node fix-subjects.js
 */
import { readFileSync, writeFileSync } from 'fs';

const OLLAMA_BASE = 'https://ollama.com';
const OLLAMA_MODEL = 'deepseek-v4-flash:cloud';
const OLLAMA_KEY = process.env.OLLAMA_API_KEY || '';

const SUBJECT_PROMPT = `你是招考公告科目提取专家。你的唯一任务是提取考试科目（examSubjects），只输出科目列表 JSON。

【硬性规则】
1. 只返回纯科目名，必须**逐字忠实原文**，不得泛化、不得缩写、不得改名。
   - 原文"高等教育心理学"→"高等教育心理学"（不是"教育心理学"）
   - 原文"医学专业基础知识"→"医学专业基础知识"（不是"专业知识"）
   - 原文"综合知识测试"→"综合知识测试"（不是"综合知识"）
   - 原文"专业基础知识"→"专业基础知识"（不是"专业知识"）
   - 原文"西医综合知识"→"西医综合知识"（不是"综合知识"）
2. 科目列表要**完整**：原文明确列出的每个科目都要提取，一个都不能漏。
   - "公共基础知识（包括法律法规、时事政治、省情省况等）" → 公共基础知识和括注里的具体科目（法律法规、时事政治、省情省况）都要列
   - "笔试分基础知识和实践操作两部分" → ["基础知识","实践操作"]
   - 多岗位/多类别（综合类/医疗类/护理类/辅导员岗/教师岗）→ 每类分别列出，合并去重
3. 剥离描述：满分/两科/一科/闭卷/考试方式/占比 等一律不提取。
4. 原文写"相关理论知识和职业素养"这类泛称 → 提取为["专业知识"]。
5. 找不到任何科目 → 返回空数组 []。
只输出 JSON 数组，如 ["公共基础知识","专业知识"]，不要输出任何其他文字。`;

const problemKeys = [
  '中国北方人才市场', '山东工艺美术学院', '山东旅游职业学院2026',
  '山东中医药大学第二附属医院2026年第二批', '山东水利技师学院', '千佛山医院',
  '山东石油化工学院', '潍坊学院', '青岛农业大学', '青岛大学', '山东省立医院',
  '山东第二医科大学附属医院2026年第二批', '青岛科技大学', '山东省公共卫生临床中心',
  '山东师范大学附属小学2026年第二批', '山东第二医科大学附属医院2026年度',
  '曲阜师范大学附属小学', '山东广播电视台', '山东师范大学第二附属中学',
  '山东师范大学附属小学2026年第一批', '山东省教育厅直属', '省属医疗卫生事业单位',
  '山东省自然资源厅',
];

async function extractSubjects(item) {
  const cleanHtml = (item.rawHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 8000);
  const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OLLAMA_KEY}` },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: SUBJECT_PROMPT },
        { role: 'user', content: `标题：${item.title}\n正文：${cleanHtml}` },
      ],
      stream: false,
      options: { temperature: 0 },
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const body = await resp.json();
  const content = body?.message?.content || '';
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) throw new Error(`未返回数组: ${content.slice(0, 80)}`);
  const arr = JSON.parse(m[0]);
  return Array.isArray(arr) ? arr : [];
}

// 主流程
const data = JSON.parse(readFileSync('./output/cleaned-data.json', 'utf-8'));
const targets = data.filter(d => problemKeys.some(k => d.title.includes(k)));
console.log('待精修样本:', targets.length, '条');

let ok = 0, fail = 0;
for (let i = 0; i < targets.length; i++) {
  const d = targets[i];
  try {
    const subjects = await extractSubjects(d);
    const old = JSON.stringify(d.examSubjects);
    d.examSubjects = subjects.slice(0, 20);
    d._subjectsRefined = true;
    ok++;
    console.log(`✅ ${String(i + 1).padStart(2)}/${targets.length} ${d.title.slice(0, 30)}`);
    console.log(`    ${old} → ${JSON.stringify(subjects)}`);
  } catch (e) {
    fail++;
    console.log(`❌ ${String(i + 1).padStart(2)}/${targets.length} ${d.title.slice(0, 30)}: ${e.message}`);
  }
}

writeFileSync('./output/cleaned-data.json', JSON.stringify(data, null, 2));
console.log(`\n完成: 成功 ${ok}，失败 ${fail}`);
