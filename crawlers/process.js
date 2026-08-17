/**
 * 数据处理主流程
 * 整合爬取、提取、去重、分类
 */

import { crawl } from './core/engine.js';
import { extractFields, batchExtract } from './core/extractor.js';
import { deduplicateByUrl, addHashes } from './core/deduplicator.js';
import { fetchAllDetails } from './core/detail-fetcher.js';
import { filterAnnouncements } from './core/ai-filter.js';
import { readFileSync, writeFileSync } from 'fs';

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

  // 2. AI 内容过滤
  console.log('  [2/6] AI 内容过滤...');
  const filtered = await filterAnnouncements(rawData, options.env);
  console.log(`  ✓ 过滤后 ${filtered.length} 条`);

  // 3. 爬取详情页
  console.log('  [3/6] 爬取详情页...');
  const withDetails = await fetchAllDetails(filtered);
  console.log(`  ✓ 详情页爬取完成`);

  // 4. 提取字段
  console.log('  [4/6] 提取字段...');
  const extracted = batchExtract(withDetails);
  console.log(`  ✓ 提取完成`);

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

  // 保存到文件
  const outputPath = './output/processed-data.json';
  writeFileSync(outputPath, JSON.stringify(globalDeduplicated, null, 2));
  console.log(`\n已保存到: ${outputPath}`);

  return {
    data: globalDeduplicated,
    stats
  };
}

// 命令行运行
processAllSites().catch(console.error);
