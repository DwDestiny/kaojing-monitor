/**
 * Ollama Cloud 直连提取质量测试
 * 用强化提示词（全字段 + deadline 语义 + 科目纯名 + 免笔试 + 反例）测 5 条历史问题样本
 */
import { readFileSync } from 'fs';

const API_KEY = process.env.OLLAMA_API_KEY;
if (!API_KEY) { console.error('缺少 OLLAMA_API_KEY'); process.exit(1); }

const SYSTEM_PROMPT = `你是招考公告信息提取专家。从公告中提取结构化信息，严格遵守以下规则：
1. registrationDeadline（报名截止日）：取报名时间段的第二个日期。如"报名时间7月1日至7月7日"→ 截止日是7月7日。注意："X月X日之前取得学历学位证书""X月X日前取得毕业证"等是资格条件日期，不是报名截止日，不要提取。
2. examSubjects（考试科目）：只返回纯科目名称。禁止返回"满分""两科""一科""考试方式""占比"等描述文字。考试分两部分的要分别列出。
   - 示例："笔试主要内容：公共基础知识（包括法律法规、时事政治、省情省况等基础性知识）和与岗位相应的专业知识两部分，分别占30%和70%" → ["公共基础知识","专业知识"]
   - 示例："笔试科目为《职业能力倾向测验》和《综合应用能力》两科，满分均为150分" → ["职业能力倾向测验","综合应用能力"]
3. examNote：整条公告明确无笔试（如"直接业务考核""简化程序直接面试，面试成绩即为总成绩""免笔试""不设笔试"）且无笔试日期时填"免笔试"；否则填 null。注意"无笔试要求的博士岗位"这类只是部分岗位免笔试，不填。
4. examDate：笔试日期，无笔试或日期未公布时填 null。
5. examType：只能从 [事业单位, 公务员, 教师招聘, 三支一扶, 医疗卫生, 国企招聘, 选调生, 其他] 中选。
6. 无把握的字段返回 null，禁止编造。但如果原文明确写了科目/日期，必须提取出来，不要因为格式不标准而漏掉。
只输出 JSON，不要输出任何其他文字。`;

const SCHEMA_HINT = `JSON 格式：
{
  "recruitCount": 数字|null,           // 招聘总人数
  "examDate": "YYYY-MM-DD"|null,       // 笔试日期
  "examTime": "HH:MM-HH:MM"|null,      // 笔试时间段
  "examSubjects": [string],            // 纯科目名数组，无则空数组
  "examType": string|null,             // 考试类型
  "examLocation": string|null,         // 考试地点
  "registrationDeadline": "YYYY-MM-DD"|null,  // 报名截止日
  "salaryRange": string|null,          // 薪资范围
  "examNote": "免笔试"|null,           // 整条无笔试时标记
  "confidence": 0-1,                   // 整体置信度
  "warnings": [string]                 // 风险警告
}`;

const tests = [
  { key: '第一康复', title: '山东省第一康复医院2026年度公开招聘人员公告' },
  { key: '新疆生产建设兵团2026年下半年', title: '新疆生产建设兵团2026年下半年' },
  { key: '食品药品检验', title: '山东省食品药品检验研究院2026年度公开招聘人员公告' },
  { key: '南方医科', title: '南方医科大学中西医结合医院2026年公开招聘专业技术人员公告' },
  { key: '中国北方人才市场', title: '中国北方人才市场' },
];

const data = JSON.parse(readFileSync('./output/re-extracted-ollama.json', 'utf-8'));

async function extract(item) {
  // 剥离 HTML 标签 + 归一化（与规则引擎一致），再截断 8KB
  const rawHtml = (item.rawHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .slice(0, 8000);
  const resp = await fetch('https://ollama.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash:cloud',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `标题：${item.title}\n正文：${rawHtml}\n\n${SCHEMA_HINT}` },
      ],
      stream: false,
      options: { temperature: 0 },
    }),
  });
  const body = await resp.json();
  const content = body?.message?.content || '';
  const m = content.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : { parseError: content.slice(0, 200) };
}

for (const t of tests) {
  const item = data.find(x => x.title.includes(t.key));
  if (!item) { console.log('未找到:', t.key); continue; }
  const t0 = Date.now();
  try {
    const r = await extract(item);
    console.log(`\n━━━ ${t.key}（${((Date.now()-t0)/1000).toFixed(1)}s）`);
    console.log('  deadline:', r.registrationDeadline, '| examDate:', r.examDate, '| type:', r.examType);
    console.log('  subjects:', JSON.stringify(r.examSubjects), '| note:', r.examNote);
    console.log('  count:', r.recruitCount, '| conf:', r.confidence);
    if (r.parseError) console.log('  ⚠ 解析失败:', r.parseError.slice(0, 150));
  } catch (e) {
    console.log(`\n━━━ ${t.key} ❌ ${e.message}`);
  }
}
