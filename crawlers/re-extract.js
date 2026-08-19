/**
 * 离线重提取脚本
 * 读取 processed-data.json（139 条，含 rawHtml），用新 pipeline 重新提取：
 *   规则优先 → AI 补缺（调线上 /api/ai/extract，JSON Mode + qwen3.8-27b）→ 合并 → 置信度审计
 * 输出：output/re-extracted.json（新数据，供 generate-import-sql 使用）
 *
 * 用法：AI_API_TOKEN=xxx node re-extract.js
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { extractFields as ruleExtractFields } from './core/extractor.js';

const WORKER_AI_BASE = 'https://kaojing-api.dangwei121105.workers.dev/api/ai';
const AI_TOKEN = process.env.AI_API_TOKEN || '';

if (!AI_TOKEN) {
  console.error('缺少 AI_API_TOKEN 环境变量');
  process.exit(1);
}

/** 调用线上 AI 提取端点（带重试 + Bearer 鉴权） */
async function callExtractAI(title, rawHtml) {
  const resp = await fetch(`${WORKER_AI_BASE}/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_TOKEN}`,
    },
    body: JSON.stringify({ title, rawHtml: rawHtml || '' }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`AI extract HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
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

/** 并发控制：N 个 worker 同时处理 */
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
  console.log(`开始重提取 ${raw.length} 条（并发 3）...`);

  const stats = { aiCalls: 0, aiSuccess: 0, ruleFallback: 0, lowConfidence: 0 };

  const results = await runConcurrent(raw, 3, async (item, i) => {
    // 1. 规则提取（本地，免费）
    const ruleFields = ruleExtractFields(item);

    // 2. AI 补缺（线上）
    let aiFields = {};
    try {
      stats.aiCalls++;
      const aiResult = await callExtractAI(item.title, item.rawHtml);
      if (aiResult && typeof aiResult === 'object') aiFields = aiResult;
      stats.aiSuccess++;
    } catch (err) {
      stats.ruleFallback++;
      console.warn(`  ⚠ [${i + 1}/${raw.length}] AI 失败，规则兜底: ${item.title.slice(0, 30)} (${err.message.slice(0, 80)})`);
    }

    // 3. 合并（规则优先）
    const finalFields = mergeFields(ruleFields, aiFields);

    // 4. 置信度审计
    if (aiFields.confidence != null && aiFields.confidence < 0.5) {
      stats.lowConfidence++;
      try {
        appendFileSync('./output/low-confidence.log',
          JSON.stringify({ title: item.title, confidence: aiFields.confidence, url: item.url }) + '\n');
      } catch {}
    }

    if (i % 15 === 0) console.log(`  ... 已处理 ${i}/${raw.length}`);
    return { ...item, ...finalFields };
  });

  // 失败项保留原数据
  const ok = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  for (const f of failed) ok.push(f.item); // 失败项退回原数据（含原 AI 值）

  const output = './output/re-extracted.json';
  writeFileSync(output, JSON.stringify(ok, null, 2));
  console.log('\n===== 重提取统计 =====');
  console.log(`总条数: ${raw.length}`);
  console.log(`AI 调用: ${stats.aiCalls}，成功: ${stats.aiSuccess}，规则兜底: ${stats.ruleFallback}，低置信度: ${stats.lowConfidence}`);
  console.log(`失败项: ${failed.length}`);
  console.log(`已保存: ${output}`);
}

main().catch(err => { console.error(err); process.exit(1); });
