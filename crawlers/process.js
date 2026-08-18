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
import { readFileSync, writeFileSync } from 'fs';

const WORKER_AI_BASE = 'https://kaojing-api.dangwei121105.workers.dev/api/ai';

/**
 * 调用已部署的 Worker AI 端点（带重试）
 * @param {string} endpoint - 'classify' | 'extract'
 * @param {object} data - 请求体
 * @param {number} retries - 失败后最多重试次数（默认 2，合计最多 3 次调用）
 * @returns {Promise<object>}
 */
async function callWorkerAI(endpoint, data, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${WORKER_AI_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
 * 三级过滤：黑名单拒绝 → 白名单通过 → Worker AI 分类
 * @param {Array} announcements
 * @returns {Promise<{filtered: Array, stats: object}>}
 */
async function filterAnnouncements(announcements) {
  const blacklist = [
    // 操作类
    '报名入口', '考试报名入口', '注册指南', '操作手册', '操作指南', '账号注册',
    '缴费入口', '准考证打印', '成绩查询',
    // 后续流程类
    '心理测评', '心理测评链接', '心理测评通知',
    '体检通知', '体检安排',
    '资格审查结果', '资格复审',
    '成绩公告', '面试名单', '面试通知',
    '拟聘用', '公示名单', '公示',
    // 活动类
    '招聘会', '宣讲会', '双选会',
    // 安全提醒类
    '陷阱', '诈骗', '风险提醒', '案例'
  ];
  const whitelist = ['招聘', '招考', '招录', '遴选'];
  const negativeKeywords = ['陷阱', '诈骗', '虚假', '风险', '提醒', '案例'];

  const filtered = [];
  const stats = {
    blacklistRejects: 0,
    whitelistPasses: 0,
    aiCalls: 0,
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

    // 第三级：不确定 → Worker AI 分类；失败时保守保留
    try {
      stats.aiCalls++;
      const result = await callWorkerAI('classify', {
        title: item.title,
        snippet: item.snippet || '',
      });

      if (result && result.isRecruitment === true) {
        filtered.push(item);
      }
    } catch (err) {
      console.warn(`  ⚠ AI 分类失败，保守保留: ${title} (${err.message})`);
      filtered.push(item);
    }
  }

  return { filtered, stats };
}

/**
 * 规则提取 + 按需 Worker AI 补全
 * @param {Array} announcements
 * @returns {Promise<{announcements: Array, stats: object}>}
 */
async function extractAnnouncements(announcements) {
  const stats = {
    aiCalls: 0,
    aiSuccess: 0,
  };
  const results = [];

  for (const item of announcements) {
    const title = item.title || '';
    const ruleFields = ruleExtractFields(item);
    let finalFields = { ...ruleFields };

    const needsAI =
      (ruleFields.recruitCount === null && (title.includes('招聘') || title.includes('招考'))) ||
      title.includes('详见附件') ||
      title.includes('岗位表') ||
      title.includes('岗位计划') ||
      title.includes('附件') ||
      title.includes('岗位一览表');

    if (needsAI) {
      try {
        stats.aiCalls++;
        const aiFields = await callWorkerAI('extract', {
          title: item.title,
          rawHtml: item.rawHtml || '',
        });

        const mergeKeys = [
          'recruitCount',
          'examSubjects',
          'examDate',
          'registrationDeadline',
          'salaryRange',
        ];

        let gotValid = false;
        for (const key of mergeKeys) {
          const value = aiFields?.[key];
          if (value === null || value === undefined) continue;
          if (key === 'examSubjects' && (!Array.isArray(value) || value.length === 0)) continue;
          finalFields[key] = value;
          gotValid = true;
        }

        if (gotValid) {
          stats.aiSuccess++;
        }
      } catch (err) {
        console.warn(`  ⚠ AI 提取失败，使用规则结果: ${title} (${err.message})`);
      }
    }

    results.push({
      ...item,
      ...finalFields,
    });
  }

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

  // 2. 混合内容过滤（规则 + Worker AI）
  console.log('  [2/6] 混合内容过滤...');
  const { filtered, stats: filterStats } = await filterAnnouncements(rawData);
  console.log(
    `  ✓ 过滤后 ${filtered.length} 条（黑名单拒绝 ${filterStats.blacklistRejects}，白名单通过 ${filterStats.whitelistPasses}，AI调用 ${filterStats.aiCalls}）`
  );

  // 3. 爬取详情页
  console.log('  [3/6] 爬取详情页...');
  const withDetails = await fetchAllDetails(filtered);
  console.log(`  ✓ 详情页爬取完成`);

  // 4. 混合字段提取（规则 + Worker AI）
  console.log('  [4/6] 提取字段...');
  const { announcements: extracted, stats: extractStats } = await extractAnnouncements(withDetails);
  console.log(`  ✓ 提取完成（AI调用 ${extractStats.aiCalls} 次，成功 ${extractStats.aiSuccess} 次）`);

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

    if (result.errors.length > 0) {
      validationResults.withErrors++;
    } else if (result.warnings.length > 0) {
      validationResults.withWarnings++;
    } else {
      validationResults.valid++;
    }

    if (result.errors.length > 0 || result.warnings.length > 0) {
      validationResults.details.push({
        title: item.title,
        url: item.url,
        warnings: result.warnings,
        errors: result.errors
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

  // 无论是否有 errors/warnings，都输出全部数据
  const outputPath = './output/processed-data.json';
  writeFileSync(outputPath, JSON.stringify(globalDeduplicated, null, 2));
  console.log(`\n已保存到: ${outputPath}`);

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
