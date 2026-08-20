/**
 * 批量审计脚本（可疑清单 + 自抓原文 + LLM 对照）
 * 用法: OLLAMA_API_KEY=xxx node scripts/audit-batch.mjs /tmp/kj-audit-input.json /tmp/kj-audit-report.json
 * 并发 3 + 重试 3；每条抓原文（浏览器 UA，10s 超时）
 */
import { readFileSync, writeFileSync } from 'fs';

const OLLAMA_BASE = 'https://ollama.com';
const OLLAMA_MODEL = 'deepseek-v4-flash:cloud';
const AI_TOKEN = process.env.OLLAMA_API_KEY || '';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

if (!AI_TOKEN) { console.error('缺少 OLLAMA_API_KEY'); process.exit(1); }

const inputPath = process.argv[2] || '/tmp/kj-audit-input.json';
const outPath = process.argv[3] || '/tmp/kj-audit-report.json';

const AUDIT_PROMPT = `你是招考公告数据核对员。下面是【公告原文】和【当前提取值】，请逐字段核对提取值是否与原文一致。
核对规则：
1. registrationDeadline（报名截止日）：应为报名时间段的第二个日期（如"报名7月1日至7月7日"→7月7日）。"X月X日前取得学历学位证书/毕业证"是资格条件日期不是报名截止。长期招聘（"报名有效期至X月X日""招满为止"）取该有效期日期。原文写"报名截止时间另行通知"应 null。
2. examDate（笔试日期）：应为明确的笔试日期。"下载打印准考证截止日"不是笔试日；"笔试时间另行通知"应为 null。
3. examTime（笔试时段）：应为笔试当天的具体时间（如"9:00-11:30"）。**重要：若该时段在原文语境中属于咨询时间、报名时间、工作时间、现场资格审核时间等非笔试场景，应判 FAIL 且期望值为 null**。
4. recruitCount（招聘人数）：应为招聘总人数（各岗位人数之和，如"副高3名+中级3名"→6）。**若原文明确写了"招聘X名/人"（含各岗位人数可求和）而提取值为空/null/0，判 FAIL**；原文确实没写人数的（如军队文职统招公告），null 可接受。
5. examSubjects（考试科目）：应为科目名列表。允许标准化别名。原文完全没写科目则空数组可接受；原文写了而提取缺失判 FAIL。
6. examType：只能属于 [事业单位,公务员,教师招聘,三支一扶,医疗卫生,国企招聘,选调生,公安辅警,其他]。**细分规则：招聘主体是医院/卫健系统且岗位以医护为主→医疗卫生；学校/教育系统且岗位以教师为主→教师招聘；警务辅助→公安辅警；否则事业单位**。标题含"医院/卫生院/疾控"而标"事业单位"，若正文岗位是医护岗，判 FAIL 期望"医疗卫生"。
7. examNote："免笔试"仅当整条公告无笔试环节（直接业务考核/简化程序直接面试且全文无笔试字样）；部分岗位免笔试不算整条免笔试。
8. examLocation：考试地点。
9. 提取值为 null/空 但原文明确有值 → 判 FAIL（漏提取）。
10. publishDate（发布日期）：公告落款/发布时间，无则接受现有值。

对每个字段输出：{"status":"PASS"或"FAIL","expected":期望正确值或null,"reason":"原因（引用原文关键句）"}。
只输出 JSON 对象，不要输出其他文字。`;

function cleanHtml(raw) {
  return (raw || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 8000);
}

async function fetchRaw(url) {
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = await res.arrayBuffer();
      // 编码探测：GBK 页面用 TextDecoder
      let html = new TextDecoder('utf-8').decode(buf);
      if (html.includes('�') || /charset=["']?gb/i.test(html.slice(0, 500))) {
        try { html = new TextDecoder('gbk').decode(buf); } catch { /* 保留 utf-8 */ }
      }
      return html;
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1500)); }
  }
  throw lastErr || new Error('fetch failed');
}

function htmlToText(html) {
  const m = html.match(/<body[\s\S]*?<\/body>/i) || [html];
  return cleanHtml(m[0]);
}

async function auditOne(item, rawHtml) {
  const payload = {
    title: item.title,
    url: item.url,
    extracted: item.extracted,
  };
  const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: AUDIT_PROMPT },
        { role: 'user', content: `【公告原文】\n标题：${item.title}\n正文：${cleanHtml(rawHtml)}\n\n【当前提取值】\n${JSON.stringify(payload.extracted, null, 1)}` },
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
  const items = JSON.parse(readFileSync(inputPath, 'utf-8'));
  console.log(`批量审计 ${items.length} 条（抓原文 + LLM 对照，并发 3）...`);

  const results = await runConcurrent(items, 3, async (item, i) => {
    // 抓原文
    let rawHtml = '';
    try { rawHtml = await fetchRaw(item.url); }
    catch (e) { return { id: item.id, title: item.title, url: item.url, _fetchError: e.message.slice(0, 60) }; }
    if (!rawHtml || rawHtml.length < 200) return { id: item.id, title: item.title, url: item.url, _fetchError: '正文过短' };

    // LLM 审计（调用级重试）
    let verdict;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { verdict = await auditOne(item, rawHtml); break; }
      catch (e) {
        if (attempt === 2) return { id: item.id, title: item.title, url: item.url, _error: e.message.slice(0, 80) };
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    if (i % 20 === 0) console.log(`  ... ${i}/${items.length}`);
    return { id: item.id, title: item.title, url: item.url, dims: item.dims, verdict };
  });

  // 汇总
  const fieldFail = {};
  const fails = [];
  let failCount = 0, errCount = 0, fetchErr = 0;
  for (const r of results) {
    if (r._fetchError) { fetchErr++; continue; }
    if (r._error) { errCount++; continue; }
    let hasFail = false;
    for (const [f, v] of Object.entries(r.verdict || {})) {
      if (v && v.status === 'FAIL') {
        hasFail = true;
        fieldFail[f] = (fieldFail[f] || 0) + 1;
        fails.push({ id: r.id, dims: r.dims, field: f, value: v, title: r.title.slice(0, 38) });
      }
    }
    if (hasFail) failCount++;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    total: items.length,
    checked: items.length - errCount - fetchErr,
    fetchErrors: fetchErr,
    llmErrors: errCount,
    itemsWithFail: failCount,
    byField: fieldFail,
    details: fails,
  };
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\n===== 审计结果 =====');
  console.log(`总条数: ${items.length} | 审计成功: ${items.length - errCount - fetchErr} | 抓原文失败: ${fetchErr} | LLM失败: ${errCount}`);
  console.log(`存在问题条目: ${failCount}`);
  console.log('按字段:', JSON.stringify(fieldFail));
  console.log('\n=== FAIL 明细 ===');
  for (const f of fails.slice(0, 80)) {
    console.log(`[${f.field}] ${f.title} (id=${f.id}): ${(f.value.reason || '').slice(0, 70)}${f.value.expected != null ? ' → ' + JSON.stringify(f.value.expected).slice(0, 50) : ''}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
