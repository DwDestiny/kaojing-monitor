/**
 * LLM 逐条数据审计（用户要求：不用脚本正则审计，交给大模型逐个对照原文）
 * 逐条把 [标题+正文] + [当前提取值] 交给 Ollama Cloud，LLM 逐字段核对：
 *   deadline（报名截止语义）/ examDate（笔试日，准考证截止日≠笔试日）
 *   recruitCount（各岗位之和）/ examSubjects（科目，允许标准化别名）
 *   examType / examNote（免笔试=整条无笔试）/ examLocation
 * 输出：output/audit-llm-report.json
 *
 * 用法：OLLAMA_API_KEY=xxx node audit-by-llm.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const OLLAMA_BASE = 'https://ollama.com';
const OLLAMA_MODEL = 'deepseek-v4-flash:cloud';
const AI_TOKEN = process.env.OLLAMA_API_KEY || '';

if (!AI_TOKEN) { console.error('缺少 OLLAMA_API_KEY'); process.exit(1); }

const AUDIT_PROMPT = `你是招考公告数据核对员。下面是【公告原文】和【当前提取值】，请逐字段核对提取值是否与原文一致。
核对规则：
1. registrationDeadline（报名截止日）：应为报名时间段的第二个日期（如"报名7月1日至7月7日"→7月7日）。注意："X月X日前取得学历学位证书/毕业证"是资格条件日期，不是报名截止。长期招聘（"报名有效期至X月X日""招满为止"）取该有效期日期。
2. examDate（笔试日期）：应为明确的笔试日期。"下载打印准考证"的截止日不是笔试日；"笔试时间另行通知"应为 null。
3. recruitCount（招聘人数）：应为招聘总人数（各岗位人数之和），如"副高3名+中级3名"→6。
4. examSubjects（考试科目）：应为科目名列表。允许标准化别名（如"行政能力测试"≈"职业能力倾向测验"、"护理专业基础"≈"护理学"、"公共基础"≈"公共基础知识"）。原文只写"专业知识"这类泛称的，提取为["专业知识"]可接受；原文完全没写科目则应为空数组。
5. examType：只能属于 [事业单位,公务员,教师招聘,三支一扶,医疗卫生,国企招聘,选调生,其他]。
6. examNote："免笔试"仅当整条公告无笔试环节（直接业务考核/简化程序直接面试且无笔试字样）；部分岗位免笔试（如"无笔试要求的博士岗位"）不算。
7. examLocation：考试地点，多地点可接受。
8. 提取值为 null/空 但原文明确有值 → 标记 FAIL（漏提取）。

对每个字段输出：{"status":"PASS"或"FAIL","expected":期望正确值或null,"reason":"原因"}。
只输出 JSON 对象，不要输出其他文字。`;

function cleanHtml(raw) {
  return (raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .slice(0, 8000);
}

async function auditOne(item) {
  const payload = {
    title: item.title,
    url: item.url,
    extracted: {
      registrationDeadline: item.registrationDeadline,
      examDate: item.examDate,
      examTime: item.examTime,
      examSubjects: item.examSubjects,
      examType: item.examType,
      examLocation: item.examLocation,
      recruitCount: item.recruitCount,
      examNote: item.examNote,
    },
  };
  const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: AUDIT_PROMPT },
        { role: 'user', content: `【公告原文】\n标题：${item.title}\n正文：${cleanHtml(item.rawHtml)}\n\n【当前提取值】\n${JSON.stringify(payload.extracted, null, 1)}` },
      ],
      stream: false,
      options: { temperature: 0 },
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const body = await resp.json();
  const content = body?.message?.content || '';
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`未返回 JSON: ${content.slice(0, 80)}`);
  return JSON.parse(m[0]);
}

async function runConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      try { results[i] = await worker(items[i], i); }
      catch (err) { results[i] = { _error: err.message }; }
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  mkdirSync('./output', { recursive: true });
  const data = JSON.parse(readFileSync('./output/cleaned-data.json', 'utf-8'));
  console.log(`LLM 逐条审计 ${data.length} 条（并发 5）...`);

  const results = await runConcurrent(data, 3, async (item, i) => {
    // 调用级重试（限流/超时兜底）
    let verdict;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { verdict = await auditOne(item); break; }
      catch (e) {
        if (attempt === 2) throw e;
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    if (i % 20 === 0) console.log(`  ... ${i}/${data.length}`);
    return { title: item.title, url: item.url, verdict };
  });

  // 汇总
  const fieldFail = {};
  const fails = [];
  let failCount = 0, errCount = 0;
  for (const r of results) {
    if (r._error) { errCount++; continue; }
    let hasFail = false;
    for (const [f, v] of Object.entries(r.verdict)) {
      if (v && v.status === 'FAIL') {
        hasFail = true;
        fieldFail[f] = (fieldFail[f] || 0) + 1;
        fails.push({ title: r.title.slice(0, 38), field: f, value: v });
      }
    }
    if (hasFail) failCount++;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    total: data.length,
    checked: data.length - errCount,
    errors: errCount,
    itemsWithFail: failCount,
    byField: fieldFail,
    details: fails,
  };
  writeFileSync('./output/audit-llm-report.json', JSON.stringify(report, null, 2));

  console.log('\n===== LLM 审计结果 =====');
  console.log(`总条数: ${data.length} | 审计成功: ${data.length - errCount} | 请求失败: ${errCount}`);
  console.log(`存在问题条目: ${failCount}`);
  console.log('按字段:', JSON.stringify(fieldFail));
  console.log('\n=== FAIL 明细 ===');
  for (const f of fails.slice(0, 60)) {
    console.log(`[${f.field}] ${f.title}: ${f.value.reason || ''}${f.value.expected != null ? ' → 应为 ' + JSON.stringify(f.value.expected) : ''}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
