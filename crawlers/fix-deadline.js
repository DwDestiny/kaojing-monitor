// 修复脚本：对 deadline 错误的条目用强化提示词重提取
// 用法：OLLAMA_API_KEY=xxx node fix-deadline.js
import { readFileSync, writeFileSync } from 'fs';
import { extractFields as ruleExtractFields } from './core/extractor.js';

const OLLAMA_BASE = 'http://localhost:11434';
const OLLAMA_MODEL = 'deepseek-v4-flash:cloud';
const AI_TOKEN = process.env.OLLAMA_API_KEY || '';

if (!AI_TOKEN) {
  console.error('缺少 OLLAMA_API_KEY');
  process.exit(1);
}

// 强化提示词：明确截止日定义
const DEADLINE_PROMPT = `请从以下招考公告中提取"报名截止日期"(registrationDeadline)。

关键规则：
- 报名截止日期 = 报名时间段中"至"之后的那个日期（结束日期）
- 例："报名时间：2026年7月1日9:00至7月7日16:00" → 截止日期是 2026-07-07
- 例："报名时间为2026年8月18日12:00至8月24日18:00" → 截止日期是 2026-08-24
- 不要把"X月X日前取得学历学位证书"、"简章有效期"、"材料提交日期"等无关日期当成报名截止日
- 找不到明确报名截止日时返回 null，禁止编造

只输出 JSON：{"registrationDeadline": "YYYY-MM-DD" 或 null, "confidence": 0-1}`;

async function callFixDeadline(title, rawHtml) {
  const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: '你是招考公告信息提取专家。严格按规则提取，禁止编造。' },
        { role: 'user', content: `${DEADLINE_PROMPT}\n\n标题：${title}\n正文：${(rawHtml || '').slice(0, 8000)}` }
      ],
      stream: false,
      options: { temperature: 0 }
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const body = await resp.json();
  const content = body?.message?.content || '';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('未返回 JSON');
  return JSON.parse(match[0]);
}

async function main() {
  const data = JSON.parse(readFileSync('./output/re-extracted-ollama.json', 'utf-8'));

  // 需要修复的 7 条（审计发现 deadline 与原文不一致）
  const fixTitles = [
    '天津市2026年度招募高校毕业生到基层从事“三支一扶”工作的公告',
    '山东省第一康复医院2026年度公开招聘人员公告',
    '山东城市建设职业学院2026年公开招聘人员公告',
    '山东青年政治学院2026年第二批公开招聘人员公告',
    '山东特殊教育职业学院2026年度公开招聘人员公告',
    '山东省工程咨询院(山东省政府投资项目评审中心)2026年公开招聘',
    '山东法官培训学院2026年公开招聘人员公告',
  ];

  console.log(`待修复 ${fixTitles.length} 条...`);
  let fixed = 0;
  for (const t of fixTitles) {
    const d = data.find(x => x.title.includes(t.slice(0, 20)));
    if (!d) { console.log(`  ❌ 未找到: ${t}`); continue; }

    const oldDeadline = d.registrationDeadline;
    // 1. 先看新规则提取器的结果
    const ruleResult = ruleExtractFields(d);
    // 2. 再调 AI 强化提取
    let aiResult = {};
    try {
      aiResult = await callFixDeadline(d.title, d.rawHtml);
      console.log(`  🤖 ${d.title.slice(0, 28)} | AI=${aiResult.registrationDeadline || 'null'} (conf=${aiResult.confidence})`);
    } catch (e) {
      console.log(`  ⚠ AI 失败: ${e.message}`);
    }

    // 3. 合并：优先 AI 高置信结果，否则新规则结果
    const newDeadline = (aiResult.confidence >= 0.7 && aiResult.registrationDeadline)
      ? aiResult.registrationDeadline
      : (ruleResult.registrationDeadline || d.registrationDeadline);

    if (newDeadline && newDeadline !== oldDeadline) {
      console.log(`  ✅ ${d.title.slice(0, 28)} | 旧=${oldDeadline} → 新=${newDeadline}`);
      d.registrationDeadline = newDeadline;
      d._deadlineFixed = true;
      fixed++;
    } else {
      console.log(`  ➖ ${d.title.slice(0, 28)} | 保持 ${oldDeadline}（AI 低置信/规则无新值）`);
    }
  }

  writeFileSync('./output/re-extracted-ollama.json', JSON.stringify(data, null, 2));
  console.log(`\n修复 ${fixed} 条，已保存 re-extracted-ollama.json`);
  console.log('提示：重新生成 SQL 并导入 D1（INPUT_JSON=./output/re-extracted-ollama.json node generate-import-sql.js）');
}

main().catch(e => { console.error(e); process.exit(1); });
