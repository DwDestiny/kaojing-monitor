/**
 * 数据处理主流程
 * 整合爬取、提取、去重、分类
 */

import { crawl } from './core/engine.js';
import { deduplicateByUrl, addHashes } from './core/deduplicator.js';
import { fetchAllDetails } from './core/detail-fetcher.js';
// import { hybridFilter } from './core/hybrid-filter.js';
// import { hybridExtract } from './core/hybrid-extractor.js';
import { extractFields as ruleExtractFields } from './core/extractor.js';
import { validateData } from './core/validator.js';
// appendFileSync/mkdirSync：用于追加 low-confidence.log（置信度审计）
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';

const WORKER_AI_BASE = 'https://kaojing-monitor.pages.dev/api/ai';
const WORKER_API_BASE = 'https://kaojing-monitor.pages.dev';

// 模块级缓存：线上已存在的公告 URL 集合（增量过滤用，一次运行只拉一次）
let existingUrlSet = null;

/**
 * 拉取线上已存在的公告 URL（分页，用于增量过滤跳过存量，省 AI 额度）
 * @returns {Promise<Set<string>>}
 */
async function fetchExistingUrls() {
  const urls = new Set();
  let page = 1;
  while (true) {
    const resp = await fetch(`${WORKER_API_BASE}/api/announcements?page=${page}&pageSize=100`);
    if (!resp.ok) break;
    const data = await resp.json();
    const items = data.data || [];
    if (items.length === 0) break;
    for (const it of items) {
      if (it.url) urls.add(it.url);
    }
    if (items.length < 100) break;
    page++;
  }
  return urls;
}

// AI 端点鉴权 token（对应 api/wrangler.toml 的 AI_API_TOKEN）
// 本地开发：通过环境变量 AI_API_TOKEN 传入；未配置时尝试读 .env.local
// ⚠️ 不要把真实 token 硬编码提交到 git（token 已写入 api/wrangler.toml，注意仓库可见性）
const AI_TOKEN = process.env.AI_API_TOKEN || '';

// ── Ollama Cloud 云端直连提取（deepseek-v4-flash:cloud，LLM 提取为主）──
const OLLAMA_BASE = 'https://ollama.com';
const OLLAMA_MODEL = 'deepseek-v4-flash:cloud';
const OLLAMA_KEY = process.env.OLLAMA_API_KEY || '';

const EXTRACT_SYSTEM_PROMPT = `你是招考公告信息提取专家。从公告中提取结构化信息，严格遵守以下规则：
1. registrationDeadline（报名截止日）：取报名时间段的第二个日期。如"报名时间7月1日至7月7日"→ 截止日是7月7日。注意："X月X日之前取得学历学位证书""X月X日前取得毕业证"等是资格条件日期，不是报名截止日，不要提取。
2. examSubjects（考试科目）：只返回纯科目名称。禁止返回"满分""两科""一科""考试方式""占比"等描述文字。考试分两部分的要分别列出。示例："笔试主要内容：公共基础知识（包括法律法规、时事政治、省情省况等基础性知识）和与岗位相应的专业知识两部分" → ["公共基础知识","专业知识"]
3. examNote：整条公告明确无笔试（如"直接业务考核""简化程序直接面试，面试成绩即为总成绩""免笔试""不设笔试"）且无笔试日期时填"免笔试"；部分岗位免笔试（如"XX岗位人员可以采取简化程序直接面试""部分岗位采取简化程序"）填"部分岗位免笔试"；其余填 null。只要原文出现"笔试内容""笔试时间""笔试科目""笔试地点""笔试成绩"等字样，说明有笔试环节，就不能填"免笔试"。
4. examDate：笔试日期，无笔试或日期未公布时填 null。
5. examType：只能从 [事业单位, 公务员, 教师招聘, 三支一扶, 医疗卫生, 国企招聘, 选调生, 公安辅警, 其他] 中选。警务辅助人员招聘填"公安辅警"。
6. 无把握的字段返回 null，禁止编造。但如果原文明确写了科目/日期，必须提取出来，不要因为格式不标准而漏掉。
只输出 JSON，不要输出任何其他文字。`;

const EXTRACT_SCHEMA_HINT = `JSON 格式：
{
  "recruitCount": 数字|null,
  "examDate": "YYYY-MM-DD"|null,
  "examTime": "HH:MM-HH:MM"|null,
  "examSubjects": [string],
  "examType": string|null,
  "examLocation": string|null,
  "registrationDeadline": "YYYY-MM-DD"|null,
  "salaryRange": string|null,
  "examNote": "免笔试"|"部分岗位免笔试"|null,
  "confidence": 0-1,
  "warnings": [string]
}`;

/**
 * 调用 Ollama Cloud 云端提取（HTML 剥离后发送；失败抛错由外层规则兜底）
 */
async function callOllamaExtract(title, rawHtml, retries = 2) {
  const cleanHtml = (rawHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .slice(0, 8000);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OLLAMA_KEY}` },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
            { role: 'user', content: `标题：${title}\n正文：${cleanHtml}\n\n${EXTRACT_SCHEMA_HINT}` },
          ],
          stream: false,
          options: { temperature: 0 },
        }),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`Ollama extract HTTP ${resp.status}: ${t.slice(0, 200)}`);
      }
      const body = await resp.json();
      const content = body?.message?.content || '';
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`Ollama 未返回 JSON: ${content.slice(0, 100)}`);
      return JSON.parse(m[0]);
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastError;
}

/**
 * 调用已部署的 Worker AI 端点（带重试 + Bearer 鉴权）
 * @param {string} endpoint - 'classify' | 'extract'
 * @param {object} data - 请求体
 * @param {number} retries - 失败后最多重试次数（默认 2，合计最多 3 次调用）
 * @returns {Promise<object>}
 */
async function callWorkerAI(endpoint, data, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (AI_TOKEN) headers['Authorization'] = `Bearer ${AI_TOKEN}`;

      const response = await fetch(`${WORKER_AI_BASE}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Worker AI ${endpoint} HTTP ${response.status}: ${text || response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw lastError;
}

/**
 * 两级过滤：黑名单拒绝 → 白名单通过，无白名单命中直接拒绝（不调用 AI）
 * @param {Array} announcements
 * @returns {Promise<{filtered: Array, stats: object}>}
 */
async function filterAnnouncements(announcements) {
  const blacklist = [
    // 操作类
    '报名入口', '考试报名入口', '注册指南', '操作手册', '操作指南', '账号注册',
    '缴费入口', '准考证打印', '准考证下载', '成绩查询',
    // 后续流程类
    '心理测评', '心理测评链接', '心理测评通知',
    '体检通知', '体检安排',
    '资格审查结果', '资格复审',
    '成绩公告', '面试名单', '面试通知', '面试人选', '面试人员', '拟进入面试',
    '合格分数线', '合格线', '分数线', '成绩公布', '成绩发布', '笔试成绩', '成绩合格',
    '拟聘用', '拟聘', '拟任', '公示名单', '人选公示', '特聘人员公示',
    // 非招考通告类
    '变更办公地址', '变更地址', '关于变更',
    '证书发放', '证书领取',
    '档案',
    '绩效',
    '职称',
    '博士后',
    '资助对象',
    '表彰推',
    '技能大奖', '技能鉴定',
    '就业促进',
    '政策解读', '攻略',
    // 活动类
    '招聘会', '联合招聘', '人才交流会', '双选会', '宣讲会',
    '推介会', '洽谈会', '对接会', '座谈会', '见面会',
    '关于举办', '活动通知', '活动公告',
    '人才夜市', '夜校',
    // 安全提醒类
    '陷阱', '诈骗', '风险提醒', '案例', '警示',
    // 劳动/社保行政类（天津等网站补充）
    '公示', '工伤', '劳动争议', '送达公告', '用工协议',
    '违法违规行为线索', '劳动保障书面审查', '积分落户', '社保卡',
  ];
  const whitelist = [
    '招聘', '招考', '招录', '遴选', '选调',
    '公开招', '公开考试', '三支一扶',
  ];
  const negativeKeywords = ['陷阱', '诈骗', '虚假', '风险', '提醒', '案例'];

  const filtered = [];
  const stats = {
    blacklistRejects: 0,
    whitelistPasses: 0,
    noWhitelistRejects: 0,
  };

  for (const item of announcements) {
    const title = item.title || '';

    // 第一级：黑名单 → 直接拒绝
    const matchedKeyword = blacklist.find(keyword => title.includes(keyword));
    if (matchedKeyword) {
      console.log(`  🚫 黑名单拦截: "${title}" (关键词: ${matchedKeyword})`);
      stats.blacklistRejects++;
      continue;
    }

    // 第一级半：正文级结果公示检测 —— 标题看似招募通知但正文是"拟招募/拟录用人员名单公示"（结果公告）
    // 案例：江苏省"三支一扶"计划招募公告（三）—— 正文通篇是名单公示，无报名指引/考试安排
    const bodyText = (item.rawHtml || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/当前位置.*?begin-->/g, '')
      .slice(0, 4000);
    const isResultAnnouncement =
      /名单进行公示|拟(?:招募|录用|聘用).{0,20}名单|公示时间[：:]\s*\d/.test(bodyText) &&
      !/报名(?:时间|方式|网址|入口|系统|网站|邮箱|安排)|笔试(?:时间|科目|日期|地点)|面试(?:时间|方式)|招募对象|招募数量|有关事项公告如下/.test(bodyText.slice(0, 2500));
    if (isResultAnnouncement) {
      console.log(`  🚫 结果公示拦截: "${title}" (正文为人员名单公示，非招募通知)`);
      stats.blacklistRejects++;
      continue;
    }

    // 第二级：白名单 → 无负面词则通过
    const hasWhitelist = whitelist.some(keyword => title.includes(keyword));
    if (hasWhitelist) {
      const hasNegative = negativeKeywords.some(keyword => title.includes(keyword));
      if (hasNegative) {
        continue;
      }
      filtered.push(item);
      stats.whitelistPasses++;
      continue;
    }

    // 第三级：无白名单关键词 → 直接拒绝（不调用 AI）
    console.log(`  🚫 无白名单关键词，拒绝: "${title}"`);
    stats.noWhitelistRejects++;
  }

  return { filtered, stats };
}

/**
 * 字段提取：分层解耦 —— 规则优先 + AI 只补缺失 + 置信度审计
 *  1. 规则提取（快、稳、可解释），始终执行
 *  2. AI 补充规则缺失的字段（失败时保持规则结果）
 *  3. 合并：规则值优先，AI 不覆盖规则已提取的值（修复 hasValidData 恒真短路导致的日期全 NULL）
 *  4. 置信度 < 0.5 记入 output/low-confidence.log 供人工抽查
 * @param {Array} announcements
 * @returns {Promise<{announcements: Array, stats: object}>}
 */
async function extractAnnouncements(announcements) {
  const stats = {
    aiCalls: 0,
    aiSuccess: 0,
    ruleFallback: 0, // AI 调用失败、退回纯规则结果的条数
    rulePrimary: 0,  // 规则提供主值（任一关键字段非空）的条数
  };
  const results = [];
  const lowConfidenceLog = './output/low-confidence.log';

  // 确保 output 目录存在（追加置信度日志用）
  mkdirSync('./output', { recursive: true });

  for (const item of announcements) {
    const title = item.title || '';

    // 第一层：规则提取（优先级最高，覆盖日期/类型/地点等 AI 经常缺失的字段）
    const ruleFields = ruleExtractFields(item);

    // 统计：规则是否提供了主值（任一关键字段有非空值即计入 rulePrimary）
    const hasRulePrimary =
      ruleFields.recruitCount != null ||
      (Array.isArray(ruleFields.examSubjects) && ruleFields.examSubjects.length > 0) ||
      ruleFields.examDate != null ||
      ruleFields.examTime != null ||
      (ruleFields.examType != null && ruleFields.examType !== '其他') ||
      ruleFields.registrationDeadline != null ||
      ruleFields.examLocation != null ||
      ruleFields.salaryRange != null;
    if (hasRulePrimary) stats.rulePrimary++;

    // 第二层：AI 补充缺失字段；调用失败时保留规则兜底
    let aiFields = {};
    try {
      stats.aiCalls++;
      const aiResult = await callOllamaExtract(item.title, item.rawHtml || '');
      // 防御：AI 返回非对象（null/字符串等）时降级为空对象
      aiFields = aiResult && typeof aiResult === 'object' ? aiResult : {};
      stats.aiSuccess++;
      console.log(`  ✓ AI 提取成功: ${title}`);
    } catch (err) {
      stats.ruleFallback++;
      console.warn(`  ⚠ AI 提取失败，使用规则兜底: ${title} (${err.message})`);
    }

    // 第三层：合并 —— LLM 提取为主（全字段），规则仅在 LLM 缺失时补缺；
    // 最终校验/否决由 upload-to-d1.js 的 rules-engine 校验层完成
    const finalFields = {
      ...aiFields,
      recruitCount: aiFields.recruitCount ?? ruleFields.recruitCount,
      examDate: aiFields.examDate ?? ruleFields.examDate,
      examTime: aiFields.examTime ?? ruleFields.examTime,
      examSubjects: aiFields.examSubjects?.length > 0 ? aiFields.examSubjects : (ruleFields.examSubjects || []),
      examType: aiFields.examType ?? ruleFields.examType,
      registrationDeadline: aiFields.registrationDeadline ?? ruleFields.registrationDeadline,
      examLocation: aiFields.examLocation ?? ruleFields.examLocation,
      salaryRange: aiFields.salaryRange ?? ruleFields.salaryRange,
      examNote: aiFields.examNote ?? null,
    };

    // 第四层：置信度审计 —— 低置信度记日志，供人工抽查
    if (aiFields.confidence != null && aiFields.confidence < 0.5) {
      const auditLine = JSON.stringify({
        title,
        confidence: aiFields.confidence,
        url: item.url || '',
      });
      console.warn(`  ⚠ 低置信度提取: ${title} (confidence=${aiFields.confidence})`);
      try {
        appendFileSync(lowConfidenceLog, auditLine + '\n', 'utf-8');
      } catch (err) {
        console.warn(`  ⚠ 写入 low-confidence.log 失败: ${err.message}`);
      }
    }

    results.push({
      ...item,
      ...finalFields,
    });
  }

  console.log(`\n提取统计: AI 调用 ${stats.aiCalls} 次, 成功 ${stats.aiSuccess} 次, 规则兜底 ${stats.ruleFallback} 条, 规则主值 ${stats.rulePrimary} 条`);
  return { announcements: results, stats };
}

/**
 * 完整数据处理流程
 * @param {object} siteConfig - 网站配置
 * @param {object} options - 选项 { page, maxPages, env }
 * @returns {Array} 处理后的数据
 */
export async function processData(siteConfig, options = {}) {
  console.log(`\n处理网站: ${siteConfig.name}`);

  // 1. 爬取列表页
  console.log('  [1/6] 爬取列表页...');
  const rawData = await crawl(siteConfig, options);
  console.log(`  ✓ 爬取 ${rawData.length} 条`);

  // 合规分级：给每条数据打上来源合规级别（safe/attribution/restricted），供 upload/API 层按级处理
  for (const it of rawData) {
    it.complianceLevel = siteConfig.complianceLevel || 'safe';
  }

  // 2. 纯规则内容过滤（黑名单 + 白名单，不调用 AI）
  console.log('  [2/6] 内容过滤...');
  const { filtered, stats: filterStats } = await filterAnnouncements(rawData);
  console.log(
    `  ✓ 过滤后 ${filtered.length} 条（黑名单拒绝 ${filterStats.blacklistRejects}，白名单通过 ${filterStats.whitelistPasses}，无白名单拒绝 ${filterStats.noWhitelistRejects}）`
  );

  // 日期阈值：只保留最近 6 个月内的公告（列表级预过滤，节省详情抓取）
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoffDate = sixMonthsAgo.toISOString().split('T')[0]; // 'YYYY-MM-DD'

  // 2.5 列表日期预过滤（>6 个月的旧公告不抓详情；无日期的条目保留，详情后兜底过滤）
  console.log(`  [2.5/6] 列表日期预过滤（保留 ${cutoffDate} 之后发布的）...`);
  const beforeDateFilter = filtered.length;
  const datePrefiltered = filtered.filter(item => {
    const pubDate = item.publishDate; // 'YYYY-MM-DD' 格式
    if (!pubDate) return true; // 无日期不预过滤（避免误杀四川 defaultDate=today 之外的缺失源）
    return pubDate >= cutoffDate;
  });
  console.log(`  ✓ 预过滤: ${beforeDateFilter} → ${datePrefiltered.length} 条（跳过 ${beforeDateFilter - datePrefiltered.length} 条旧公告）`);

  // 2.7 增量过滤提前：跳过线上已存在的公告（只对"新公告"抓详情 + 调 AI，大幅减少详情抓取量与 LLM 额度）
  console.log('  [2.7/6] 增量过滤提前（跳过线上已有公告）...');
  if (existingUrlSet === null) {
    existingUrlSet = await fetchExistingUrls();
    console.log(`  ✓ 线上已有 ${existingUrlSet.size} 条公告 URL`);
  }
  const beforeIncremental = datePrefiltered.length;
  const newOnly = datePrefiltered.filter(a => !existingUrlSet.has(a.url));
  console.log(`  ✓ 增量过滤: ${beforeIncremental} → ${newOnly.length} 条（跳过 ${beforeIncremental - newOnly.length} 条线上已有）`);

  // 3. 爬取详情页（只抓新公告；restricted 合规源【军队文职】跳过详情——仅索引，不存正文；
  //    detailInList 源【河北】列表 API 已含正文 articleContent，跳过详情抓取避免 SPA 壳覆盖）
  const isRestricted = siteConfig.complianceLevel === 'restricted';
  const detailInList = siteConfig.detailInList === true;
  const skipDetail = isRestricted || detailInList;
  console.log(`  [3/6] 爬取详情页...${isRestricted ? '（restricted 合规源：跳过详情，仅索引）' : ''}${detailInList ? '（detailInList：列表已含正文）' : ''}`);
  const withDetails = skipDetail ? newOnly : await fetchAllDetails(newOnly);
  console.log(`  ✓ 详情页处理完成（${withDetails.length} 条）`);

  // 3.5 兜底日期过滤（详情抓取后复查；无日期条目这里会被移除，避免脏数据）
  console.log(`  [3.5/6] 兜底日期过滤（保留 ${cutoffDate} 之后发布的）...`);
  const beforeFilter = withDetails.length;
  const recentAnnouncements = withDetails.filter(item => {
    const pubDate = item.publishDate;
    return pubDate && pubDate >= cutoffDate;
  });
  console.log(`  ✓ 已过滤: ${beforeFilter} → ${recentAnnouncements.length} 条（移除 ${beforeFilter - recentAnnouncements.length} 条）`);

  // 4. AI 优先字段提取（失败则规则兜底）
  console.log('  [4/6] 提取字段...');
  const { announcements: extracted, stats: extractStats } = await extractAnnouncements(recentAnnouncements);
  console.log(`  ✓ 提取完成（AI调用 ${extractStats.aiCalls} 次，成功 ${extractStats.aiSuccess} 次，规则兜底 ${extractStats.ruleFallback} 条，规则主值 ${extractStats.rulePrimary} 条）`);

  // 5. 去重
  console.log('  [5/6] 去重...');
  const deduplicated = deduplicateByUrl(extracted);
  console.log(`  ✓ 去重后 ${deduplicated.length} 条`);

  // 6. 添加 hash
  console.log('  [6/6] 添加 hash...');
  const withHashes = addHashes(deduplicated);
  console.log(`  ✓ 处理完成`);

  return withHashes;
}

/**
 * 批量处理所有已启用网站
 */
export async function processAllSites() {
  const config = JSON.parse(readFileSync('./config/sites.json', 'utf-8'));
  const enabledSites = config.sites.filter(s => s.enabled);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`批量处理 ${enabledSites.length} 个网站`);
  console.log(`${'='.repeat(60)}`);

  const allData = [];
  const stats = {
    totalSites: enabledSites.length,
    successSites: 0,
    failedSites: 0,
    totalAnnouncements: 0
  };

  for (const site of enabledSites) {
    try {
      const data = await processData(site, { page: 1, maxPages: 1 });
      allData.push(...data);
      stats.successSites++;
      stats.totalAnnouncements += data.length;

      // 延迟 2 秒（合规）
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`  ✗ 处理失败: ${error.message}`);
      stats.failedSites++;
    }
  }

  // 全局去重
  console.log(`\n全局去重...`);
  const globalDeduplicated = deduplicateByUrl(allData);

  console.log(`\n${'='.repeat(60)}`);
  console.log('批量处理完成');
  console.log(`${'='.repeat(60)}`);
  console.log(`成功: ${stats.successSites}/${stats.totalSites} 个网站`);
  console.log(`失败: ${stats.failedSites} 个网站`);
  console.log(`总数据: ${stats.totalAnnouncements} 条`);
  console.log(`去重后: ${globalDeduplicated.length} 条`);

  // 先保存数据，再做验证（验证失败不影响输出）
  const outputPath = './output/processed-data.json';
  writeFileSync(outputPath, JSON.stringify(globalDeduplicated, null, 2));
  console.log(`\n已保存到: ${outputPath}`);

  // 数据验证（失败不阻止输出，只记录问题）
  const validationResults = {
    total: 0,
    valid: 0,
    withWarnings: 0,
    withErrors: 0,
    details: []
  };

  for (const item of globalDeduplicated) {
    const result = validateData(item);
    validationResults.total++;

    const errors = result.errors || [];
    const warnings = result.warnings || [];

    if (errors.length > 0) {
      validationResults.withErrors++;
    } else if (warnings.length > 0) {
      validationResults.withWarnings++;
    } else {
      validationResults.valid++;
    }

    if (errors.length > 0 || warnings.length > 0) {
      validationResults.details.push({
        title: item.title,
        url: item.url,
        warnings,
        errors
      });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('数据验证结果');
  console.log(`${'='.repeat(60)}`);
  console.log(`总计: ${validationResults.total} 条`);
  console.log(`✓ 完全有效: ${validationResults.valid} 条`);
  console.log(`⚠ 有警告: ${validationResults.withWarnings} 条`);
  console.log(`✗ 有错误: ${validationResults.withErrors} 条`);

  const reportPath = './output/validation-report.json';
  writeFileSync(reportPath, JSON.stringify(validationResults, null, 2));
  console.log(`验证报告已保存到: ${reportPath}`);

  return {
    data: globalDeduplicated,
    stats,
    validationResults
  };
}

// 命令行运行（被 import 时不自动执行，防止测试/复用触发全量爬取）
const isCli = process.argv[1] && process.argv[1].endsWith('process.js');
if (isCli) {
  processAllSites().catch(console.error);
}
