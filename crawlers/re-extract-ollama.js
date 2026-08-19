/**
 * 离线重提取脚本 v2（Ollama Cloud 后端）
 * 读取 processed-data.json（139 条，含 rawHtml），用新 pipeline 重新提取：
 *   规则优先 → AI 补缺（Ollama Cloud deepseek-v4-flash:cloud）→ 合并 → 置信度审计
 * 输出：output/re-extracted-ollama.json
 *
 * 用法：OLLAMA_API_KEY=xxx node re-extract-ollama.js
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { extractFields as ruleExtractFields } from './core/extractor.js';

const OLLAMA_BASE = 'http://localhost:11434';
const OLLAMA_MODEL = 'deepseek-v4-flash:cloud';
const AI_TOKEN = process.env.OLLAMA_API_KEY || '';

if (!AI_TOKEN) {
  console.error('缺少 OLLAMA_API_KEY 环境变量');
  process.exit(1);
}

const EXTRACT_SCHEMA_PROMPT = `请从公告中提取以下字段，只输出一个 JSON 对象，不要输出其他任何文字：
{
  "recruitCount": 招聘总人数(整数)或 null,
  "examDate": 笔试日期 YYYY-MM-DD 或 null,
  "examTime": 考试时间(如 9:00-11:30)或 null,
  "examSubjects": 考试科目数组(如 ["综合应用能力A类"])，找不到返回 [],
  "examType": 考试类型(事业单位/公务员/教师招聘/三支一扶/医疗卫生/国企招聘/选调生/其他)或 null,
  "examLocation": 考试地点或 null,
  "registrationDeadline": 报名截止日期 YYYY-MM-DD 或 null,
  "salaryRange": 薪资范围或 null,
  "confidence": 提取置信度(0-1之间的小数)
}
规则：
- 无把握的字段必须返回 null 或 []，禁止编造
- 忽略规则说明中的数字（如"每人限报1个职位"）
- 考试科目保留原始名称，不要改写`;

/** 调用 Ollama Cloud 提取 */
async function callExtractAI(title, rawHtml) {
  const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: '你是招考公告信息提取专家。严格按用户要求的 JSON schema 输出，禁止编造。' },
        { role: 'user', content: `${EXTRACT_SCHEMA_PROMPT}\n\n标题：${title}\n正文：${(rawHtml || '').slice(0, 8000)}` }
      ],
      stream: false,
      options: { temperature: 0 }
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

/** 规则优先 + AI 补缺 合并 */
function mergeFields(ruleFields, aiFields) {
  return {
    ...aiFields,
    recruitCount: ruleFields.recruitCount ?? aiFields.recruitCount,
    examDate: ruleFields.examDate ?? aiFields.examDate,
    examTime: ruleFields.examTime ?? aiFields.examTime,
    examSubjects: ruleFields.examSubjects?.length > 0 ? ruleFields.examSubjects : aiFields.examSubjects,
    examType: ruleFields.examType != null && ruleFields.examType !== '其他' ? ruleFields.examType : aiFields.examType,
    registrationDeadline: ruleFields.registrationDeadline ?? aiFields.registrationDeadline,
    examLocation: ruleFields.examLocation ?? aiFields.examLocation,
    salaryRange: ruleFields.salaryRange ?? aiFields.salaryRange,
  };
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
  console.log(`开始 Ollama 重提取 ${raw.length} 条（并发 3，模型 ${OLLAMA_MODEL}）...`);

  const stats = { aiCalls: 0, aiSuccess: 0, ruleFallback: 0, lowConfidence: 0 };

  const results = await runConcurrent(raw, 3, async (item, i) => {
    const ruleFields = ruleExtractFields(item);

    let aiFields = {};
    try {
      stats.aiCalls++;
      aiFields = await callExtractAI(item.title, item.rawHtml);
      stats.aiSuccess++;
    } catch (err) {
      stats.ruleFallback++;
      console.warn(`  ⚠ [${i + 1}/${raw.length}] AI 失败，规则兜底: ${item.title.slice(0, 30)} (${err.message.slice(0, 80)})`);
    }

    const finalFields = mergeFields(ruleFields, aiFields);

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
  console.log('\n===== Ollama 重提取统计 =====');
  console.log(`总条数: ${raw.length}`);
  console.log(`AI 调用: ${stats.aiCalls}，成功: ${stats.aiSuccess}，规则兜底: ${stats.ruleFallback}，低置信度: ${stats.lowConfidence}`);
  console.log(`失败项: ${failed.length}`);
  console.log(`已保存: ${output}`);
}

main().catch(err => { console.error(err); process.exit(1); });
