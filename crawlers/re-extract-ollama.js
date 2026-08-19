/**
 * 离线重提取脚本 v4（Ollama Cloud 云端直连，LLM 提取为主）
 * v4 改进（基于 LLM 审计 48 条问题的根因修复）：
 *   1. 强化提示词：自检指令 + 免笔试整条/部分判定规则 + 多岗位科目 + examType 规范
 *   2. 失败重试：AI 未返回 JSON 时重试 3 次（换简化输入），不降级到规则提取覆盖
 *   3. 思维链开启（think: true）
 * 输出：output/re-extracted-ollama.json（校验由 rules-engine.js 校验层负责）
 *
 * 用法：OLLAMA_API_KEY=xxx node re-extract-ollama.js
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { extractFields as ruleExtractFields } from './core/extractor.js';

const OLLAMA_BASE = 'https://ollama.com';
const OLLAMA_MODEL = 'deepseek-v4-flash:cloud';
const AI_TOKEN = process.env.OLLAMA_API_KEY || '';

if (!AI_TOKEN) {
  console.error('缺少 OLLAMA_API_KEY 环境变量');
  process.exit(1);
}

const SYSTEM_PROMPT = `你是招考公告信息提取专家。从公告中提取结构化信息，输出前必须逐字段回查原文核对。

【字段规则】
1. recruitCount（招聘人数）：招聘总人数 = 各岗位人数之和（如"副高3名+中级3名"→6）。原文明确写出的总数优先。
2. registrationDeadline（报名截止日）：报名时间段的第二个日期（"报名7月1日至7月7日"→7月7日）。注意："X月X日之前取得学历学位证书""X月X日前取得毕业证"是资格条件日期，不是报名截止日。长期招聘（"报名有效期至X月X日""招满为止""长期报名"）取该有效期日期。
3. examDate（笔试日期）：明确的笔试时间。注意："下载打印准考证"的截止日不是笔试日；"笔试时间另行通知"→null。
4. examSubjects（考试科目）：**纯科目名**列表，剥离"满分/两科/一科/考试方式/占比/包括/岗位前缀"等一切描述。多岗位/多类别（辅导员岗+教师岗、综合类+医疗类+护理类）必须**分别列出所有类别**，不能只提一种。考试分两部分的分别列出。
   示例："笔试主要内容：公共基础知识（包括法律法规、时事政治、省情省况等基础性知识）和与岗位相应的专业知识两部分"→["公共基础知识","专业知识"]。
   示例："笔试内容包括三部分：习近平新时代中国特色社会主义思想、教育理论基础知识、行政能力测试"→["习近平新时代中国特色社会主义思想","教育理论基础知识","行政能力测试"]。
5. examType：只能从 [事业单位,公务员,教师招聘,三支一扶,医疗卫生,国企招聘,选调生,其他] 中选。省属事业单位公开招聘填"事业单位"。
6. examNote（免笔试标记）：仅当**整条公告**无笔试环节时填"免笔试"，判定规则：
   - 标题含"博士/高级/高层次人员/岗位"专项（如"公开招聘博士人员公告""公开招聘高级及博士人员公告"）→ 整条免笔试
   - 正文"面向博士/高级/高层次(的)招聘采取简化程序直接面试"→ 整条免笔试
   - "XX岗位(人员)可以/可采取简化程序直接面试"（如"副高级以上专业技术岗位人员，可以采取"）→ 部分岗位免笔试，**不填**
   - 原文出现"笔试内容/笔试时间/笔试科目/笔试地点/笔试成绩"等字样 → 说明有笔试环节，**不填**
7. 无把握的字段返回 null，禁止编造。但如果原文明确写了科目/日期/人数，必须提取出来，不要因为格式不标准而漏掉。

【输出前自检】逐项确认：
① 人数=各岗位之和了吗？② 多岗位的科目都分别列出来了吗？③ 报名截止取的是"至"后面的第二个日期吗？④ 免笔试是整条还是部分岗位？⑤ 有没有字段原文明明有却被漏掉？
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

/** HTML 剥离 + 归一化 */
function cleanHtml(raw, limit = 8000) {
  return (raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .slice(0, limit);
}

/**
 * 调用 Ollama Cloud 云端提取（失败重试 3 次，不降级规则覆盖）
 * 重试策略：第 1 次完整 8KB；后续重试截断到 4KB（长文本超时/截断时简化输入）
 */
async function callExtractAI(title, rawHtml) {
  let lastError;
  const attempts = [
    { limit: 8000, note: '完整' },
    { limit: 4000, note: '4KB' },
    { limit: 2000, note: '2KB' },
  ];
  for (let i = 0; i < attempts.length; i++) {
    const { limit, note } = attempts[i];
    try {
      const body = JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `标题：${title}\n正文：${cleanHtml(rawHtml, limit)}\n\n${SCHEMA_HINT}` },
        ],
        stream: false,
        // 不显式传 think（显式 think:true 会让思维链超长拖慢 5 倍且模型过度自我怀疑；
        // deepseek-v4-flash 默认即带思维链，提示词的"输出前自检"已起到引导深度思考的作用）
        options: { temperature: 0 },
      });
      const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_TOKEN}` },
        body,
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${t.slice(0, 150)}`);
      }
      const res = await resp.json();
      const content = res?.message?.content || '';
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`未返回 JSON: ${content.slice(0, 80)}`);
      const parsed = JSON.parse(m[0]);
      // 宽容校验：只要求 JSON 可解析 + 有任一业务字段；字段缺失/类型不符交由 rules-engine 校验层兜底
      // （教训：提取层严格判死会导致"examSubjects:null"等合法输出被误杀 → 无谓重试 → 规则补缺老问题复发）
      if (parsed && typeof parsed === 'object') {
        if (parsed.examSubjects === null || typeof parsed.examSubjects === 'string') parsed.examSubjects = [];
        return parsed;
      }
      throw new Error('非对象 JSON');
    } catch (err) {
      lastError = err;
      console.warn(`  ⚠ 第 ${i + 1} 次尝试失败（${note}输入）: ${err.message.slice(0, 60)}`);
    }
  }
  throw lastError;
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
  console.log(`开始 Ollama Cloud v4 重提取 ${raw.length} 条（并发 3，失败自动重试）...`);

  const stats = { aiCalls: 0, aiSuccess: 0, ruleFallback: 0, lowConfidence: 0 };

  const results = await runConcurrent(raw, 3, async (item, i) => {
    // AI 提取为主；仅在 3 次重试全部失败时才用规则补缺（宁缺毋滥：规则只补缺失字段，不覆盖 AI 已给值）
    let aiFields = {};
    try {
      stats.aiCalls++;
      aiFields = await callExtractAI(item.title, item.rawHtml);
      stats.aiSuccess++;
    } catch (err) {
      stats.ruleFallback++;
      console.warn(`  ✗ [${i + 1}/${raw.length}] AI 3 次重试失败: ${item.title.slice(0, 30)} → 规则补缺`);
      const ruleFields = ruleExtractFields(item);
      aiFields = {
        recruitCount: ruleFields.recruitCount,
        examDate: ruleFields.examDate,
        examTime: ruleFields.examTime,
        examSubjects: Array.isArray(ruleFields.examSubjects) ? ruleFields.examSubjects : [],
        examType: ruleFields.examType,
        examLocation: ruleFields.examLocation,
        registrationDeadline: ruleFields.registrationDeadline,
        salaryRange: ruleFields.salaryRange,
        examNote: null,
        confidence: null,
      };
    }

    const finalFields = {
      ...aiFields,
      examSubjects: Array.isArray(aiFields.examSubjects) ? aiFields.examSubjects : [],
    };

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
  console.log('\n===== Ollama Cloud v4 重提取统计 =====');
  console.log(`总条数: ${raw.length}`);
  console.log(`AI 调用: ${stats.aiCalls}，成功: ${stats.aiSuccess}，规则补缺(3次重试失败): ${stats.ruleFallback}，低置信度: ${stats.lowConfidence}`);
  console.log(`已保存: ${output}`);
}

main().catch(err => { console.error(err); process.exit(1); });
