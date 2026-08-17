/**
 * 爬虫测试脚本
 * 测试所有已启用的网站配置
 */

import { readFileSync } from 'fs';
import { crawl } from './core/engine.js';

async function testAll() {
  // 加载网站配置
  const config = JSON.parse(readFileSync('./config/sites.json', 'utf-8'));
  const enabledSites = config.sites.filter(s => s.enabled);

  console.log(`开始测试 ${enabledSites.length} 个网站...\n`);

  const results = [];

  for (const site of enabledSites) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试: ${site.name} (${site.id})`);
    console.log(`${'='.repeat(60)}`);

    try {
      const items = await crawl(site, { page: 1, maxPages: 1 });

      console.log(`✅ 成功: 抓取 ${items.length} 条数据`);

      if (items.length > 0) {
        console.log('\n示例数据 (第 1 条):');
        console.log(JSON.stringify(items[0], null, 2));
      }

      results.push({
        site: site.name,
        id: site.id,
        success: true,
        count: items.length,
        sample: items[0]
      });

    } catch (error) {
      console.error(`❌ 失败: ${error.message}`);
      results.push({
        site: site.name,
        id: site.id,
        success: false,
        error: error.message
      });
    }
  }

  // 汇总报告
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('测试汇总');
  console.log(`${'='.repeat(60)}`);

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  console.log(`总计: ${results.length} 个网站`);
  console.log(`成功: ${successCount} 个 ✅`);
  console.log(`失败: ${failedCount} 个 ❌`);

  if (failedCount > 0) {
    console.log('\n失败列表:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.site}: ${r.error}`);
    });
  }

  console.log('\n成功列表:');
  results.filter(r => r.success).forEach(r => {
    console.log(`  - ${r.site}: ${r.count} 条数据`);
  });
}

testAll().catch(console.error);
