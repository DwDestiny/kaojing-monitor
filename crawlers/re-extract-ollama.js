/**
 * 离线重提取脚本 v3（Ollama Cloud 云端直连，LLM 提取为主）
 * 读取 processed-data.json（139 条，含 rawHtml）：
 *   LLM 强化提示词提取全字段（deadline 语义/科目纯名/免笔试/反例）
 *   AI 失败 → 规则提取兜底（extractor.js）
 * 输出：output/re-extracted-ollama.json（校验由 rules-engine.js 校验层负责）
 *
 * 用法：OLLAMA_API_KEY=xxx node re-extract-ollama.js
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { extractFields as ruleExtractFields } from './core/extractor.js';

// 云端直连：ollama.com（deepseek-v4-flash:cloud 是云模型，无需本地 Ollama）
const OLLAMA_BASE = 'https://ollama.com';
const OLLAMA_MODEL = 'deepseek-v4-flash:cloud';
const AI_TOKEN = process.env.OLLAMA_API_KEY || '';

if (!AI_TOKEN) {
  console.error('缺少 OLLAMA_API_KEY 环境变量');
  process.exit(1);
}

const SYSTEM_PROMPT = `你是招考公告信息提取专家。从公告中提取结构化信息，严格遵守以下规则：
1. registrationDeadline（报名截止日）：取报名时间段的第二个日期。如"报名时间7月1日至7月7日"→ 截止日是7月7日。注意："X月X日之前取得学历学位证书""X月X日前取得毕业证"等是资格条件日期，不是报名截止日，不要提取。
2. examSubjects（考试科目）：只返回纯科目名称。禁止返回"满分""两科""一科""考试方式""占比"等描述文字。考试分两部分的要分别列出。
   - 示例："笔试主要内容：公共基础知识（包括法律法规、时事政治、省情省况等基础性知识）和与岗位相应的专业知识两部分，分别占30%和70%" → ["公共基础知识","专业知识"]
   - 示例："笔试科目为《职业能力倾向测验》和《综合应用能力》两科，满分均为150分" → ["职业能力倾向测验","综合应用能力"]
3. examNote：整条公告明确无笔试（如"直接业务考核""简化程序直接面试，面试成绩即为总成绩""免笔试""不设笔试"）且无笔试日期时填"免笔试"；否则填 null。注意"无笔试要求的博士岗位"这类只是部分岗位免笔试，不填。只要原文出现"笔试内容""笔试时间""笔试科目""笔试地点""笔试成绩"等字样，说明有笔试环节，就不能填"免笔试"。
4. examDate：笔试日期，无笔试或日期未公布时填 null。
5. examType：只能从 [事业单位, 公务员, 教师招聘, 三支一扶, 医疗卫生, 国企招聘, 选调生, 其他] 中选。
6. 无把握的字段返回 null，禁止编造。但如果原文明确写了科目/日期，必须提取出来，不要因为格式不标准而漏掉。
只输出 JSON，不要输出任何其他文字。`;

const SCHEMA_HINT = `JSON 格式：
{
  "recruitCount": 数字|null,
  "examDate": "YYYY-MM-DD"|null,
  "examTime": "HH:MM-HH:MM"|null,
  "examSubjects": [string],
  "examType": string|null,
  "examLocation": string|null,
  "registrationDeadline": "YYYY-MM-DD"|null,
  "salaryRange": string|null,
  "examNote": "免笔试"|null,
  "confidence": 0-1,
  "warnings": [string]
}`;

/** 调用 Ollama Cloud 云端提取（HTML 剥离后发送，提升准确率） */
async function callExtractAI(title, rawHtml) {
  const cleanHtml = (rawHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .slice(0, 8000);
  const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_TOKEN}`,
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `标题：${title}\n正文：${cleanHtml}\n\n${SCHEMA_HINT}` },
      ],
      stream: false,
      options: { temperature: 0 },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Ollama extract HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  const body = await resp.json();
  const content = body?.message?.content || '';
  // 提取 JSON 对象（防御模型输出额外文字）
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Ollama 未返回 JSON: ${content.slice(0, 100)}`);
  return JSON.parse(match[0]);
}

/** 并发控制 */
async function runConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { error: err.message, item: items[i] };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  mkdirSync('./output', { recursive: true });
  const raw = JSON.parse(readFileSync('./output/processed-data.json', 'utf-8'));
  console.log(`开始 Ollama Cloud 重提取 ${raw.length} 条（并发 3，模型 ${OLLAMA_MODEL}）...`);

  const stats = { aiCalls: 0, aiSuccess: 0, ruleFallback: 0, lowConfidence: 0 };

  const results = await runConcurrent(raw, 3, async (item, i) => {
    const ruleFields = ruleExtractFields(item); // 兜底用

    let aiFields = {};
    try {
      stats.aiCalls++;
      aiFields = await callExtractAI(item.title, item.rawHtml);
      stats.aiSuccess++;
    } catch (err) {
      stats.ruleFallback++;
      console.warn(`  ⚠ [${i + 1}/${raw.length}] AI 失败，规则兜底: ${item.title.slice(0, 30)} (${err.message.slice(0, 80)})`);
    }

    // LLM 提取为主；AI 失败才用规则值（规则不再覆盖 AI）
    const finalFields = stats.ruleFallback > 0 && Object.keys(aiFields).length === 0
      ? ruleFields
      : { ...aiFields, examSubjects: Array.isArray(aiFields.examSubjects) ? aiFields.examSubjects : [] };

    if (aiFields.confidence != null && aiFields.confidence < 0.5) {
      stats.lowConfidence++;
      try {
        appendFileSync('./output/low-confidence-ollama.log',
          JSON.stringify({ title: item.title, confidence: aiFields.confidence, url: item.url }) + '\n');
      } catch {}
    }

    if (i % 20 === 0) console.log(`  ... 已处理 ${i}/${raw.length}`);
    return { ...item, ...finalFields };
  });

  const ok = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  for (const f of failed) ok.push(f.item);

  const output = './output/re-extracted-ollama.json';
  writeFileSync(output, JSON.stringify(ok, null, 2));
  console.log('\n===== Ollama Cloud 重提取统计 =====');
  console.log(`总条数: ${raw.length}`);
  console.log(`AI 调用: ${stats.aiCalls}，成功: ${stats.aiSuccess}，规则兜底: ${stats.ruleFallback}，低置信度: ${stats.lowConfidence}`);
  console.log(`失败项: ${failed.length}`);
  console.log(`已保存: ${output}`);
}

main().catch(err => { console.error(err); process.exit(1); });
