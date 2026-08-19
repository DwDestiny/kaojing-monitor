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

const WORKER_AI_BASE = 'https://kaojing-api.dangwei121105.workers.dev/api/ai';

// AI 端点鉴权 token（对应 api/wrangler.toml 的 AI_API_TOKEN）
// 本地开发：通过环境变量 AI_API_TOKEN 传入；未配置时尝试读 .env.local
// ⚠️ 不要把真实 token 硬编码提交到 git（token 已写入 api/wrangler.toml，注意仓库可见性）
const AI_TOKEN = process.env.AI_API_TOKEN || '';

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
    '成绩公告', '面试名单', '面试通知',
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
      const aiResult = await callWorkerAI('extract', {
        title: item.title,
        rawHtml: item.rawHtml || '',
      });
      // 防御：AI 返回非对象（null/字符串等）时降级为空对象
      aiFields = aiResult && typeof aiResult === 'object' ? aiResult : {};
      stats.aiSuccess++;
      console.log(`  ✓ AI 提取成功: ${title}`);
    } catch (err) {
      stats.ruleFallback++;
      console.warn(`  ⚠ AI 提取失败，使用规则兜底: ${title} (${err.message})`);
    }

    // 第三层：合并 —— 规则字段优先，AI 只补规则缺失的字段
    const finalFields = {
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

  // 2. 纯规则内容过滤（黑名单 + 白名单，不调用 AI）
  console.log('  [2/6] 内容过滤...');
  const { filtered, stats: filterStats } = await filterAnnouncements(rawData);
  console.log(
    `  ✓ 过滤后 ${filtered.length} 条（黑名单拒绝 ${filterStats.blacklistRejects}，白名单通过 ${filterStats.whitelistPasses}，无白名单拒绝 ${filterStats.noWhitelistRejects}）`
  );

  // 3. 爬取详情页
  console.log('  [3/6] 爬取详情页...');
  const withDetails = await fetchAllDetails(filtered);
  console.log(`  ✓ 详情页爬取完成`);

  // 日期过滤：只保留最近 6 个月内的公告
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoffDate = sixMonthsAgo.toISOString().split('T')[0]; // 'YYYY-MM-DD'

  console.log(`  [3.5/6] 过滤旧公告（保留 ${cutoffDate} 之后发布的）...`);
  const beforeFilter = withDetails.length;
  const recentAnnouncements = withDetails.filter(item => {
    const pubDate = item.publishDate; // 'YYYY-MM-DD' 格式
    return pubDate && pubDate >= cutoffDate;
  });
  console.log(`  ✓ 已过滤: ${beforeFilter} → ${recentAnnouncements.length} 条（移除 ${beforeFilter - recentAnnouncements.length} 条旧公告）`);

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

// 命令行运行
processAllSites().catch(console.error);
