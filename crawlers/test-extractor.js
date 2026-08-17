/**
 * 数据提取模块测试
 * 测试从真实爬取数据中提取字段
 */

import { readFileSync } from 'fs';
import { crawl } from './core/engine.js';
import { extractFields, batchExtract } from './core/extractor.js';

async function testExtractor() {
  console.log('='.repeat(60));
  console.log('数据提取模块测试');
  console.log('='.repeat(60));

  // 加载网站配置
  const config = JSON.parse(readFileSync('./config/sites.json', 'utf-8'));

  // 选择一个数据量大的网站测试（山东省）
  const testSite = config.sites.find(s => s.id === 'shandong_hrss');

  console.log(`\n测试网站: ${testSite.name}`);
  console.log('爬取前 10 条数据...\n');

  // 爬取数据
  const announcements = await crawl(testSite, { page: 1, maxPages: 1 });
  const sample = announcements.slice(0, 10);

  console.log(`成功爬取 ${sample.length} 条数据`);
  console.log('\n开始提取字段...\n');

  // 提取字段
  const extracted = batchExtract(sample);

  // 统计提取成功率
  const stats = {
    total: extracted.length,
    recruitCount: extracted.filter(e => e.recruitCount !== null).length,
    examDate: extracted.filter(e => e.examDate !== null).length,
    examTime: extracted.filter(e => e.examTime !== null).length,
    examSubjects: extracted.filter(e => e.examSubjects.length > 0).length,
    examType: extracted.filter(e => e.examType !== '其他').length,
    registrationDeadline: extracted.filter(e => e.registrationDeadline !== null).length,
    examLocation: extracted.filter(e => e.examLocation !== null).length,
    salaryRange: extracted.filter(e => e.salaryRange !== null).length
  };

  console.log('='.repeat(60));
  console.log('提取统计');
  console.log('='.repeat(60));
  console.log(`总计: ${stats.total} 条`);
  console.log(`招考人数: ${stats.recruitCount} 条 (${(stats.recruitCount / stats.total * 100).toFixed(1)}%)`);
  console.log(`笔试日期: ${stats.examDate} 条 (${(stats.examDate / stats.total * 100).toFixed(1)}%)`);
  console.log(`笔试时间: ${stats.examTime} 条 (${(stats.examTime / stats.total * 100).toFixed(1)}%)`);
  console.log(`考试科目: ${stats.examSubjects} 条 (${(stats.examSubjects / stats.total * 100).toFixed(1)}%)`);
  console.log(`考试类型: ${stats.examType} 条 (${(stats.examType / stats.total * 100).toFixed(1)}%)`);
  console.log(`报名截止: ${stats.registrationDeadline} 条 (${(stats.registrationDeadline / stats.total * 100).toFixed(1)}%)`);
  console.log(`考试地点: ${stats.examLocation} 条 (${(stats.examLocation / stats.total * 100).toFixed(1)}%)`);
  console.log(`薪资范围: ${stats.salaryRange} 条 (${(stats.salaryRange / stats.total * 100).toFixed(1)}%)`);

  // 展示示例
  console.log('\n' + '='.repeat(60));
  console.log('提取示例（前 3 条）');
  console.log('='.repeat(60));

  extracted.slice(0, 3).forEach((item, index) => {
    console.log(`\n【示例 ${index + 1}】`);
    console.log(`标题: ${item.title}`);
    console.log(`来源: ${item.source} (${item.region})`);
    console.log(`发布日期: ${item.publishDate}`);
    console.log(`\n提取字段:`);
    console.log(`  • 考试类型: ${item.examType}`);
    console.log(`  • 招考人数: ${item.recruitCount || '未提取'}`);
    console.log(`  • 笔试日期: ${item.examDate || '未提取'}`);
    console.log(`  • 笔试时间: ${item.examTime || '未提取'}`);
    console.log(`  • 考试科目: ${item.examSubjects.length > 0 ? item.examSubjects.join('、') : '未提取'}`);
    console.log(`  • 报名截止: ${item.registrationDeadline || '未提取'}`);
    console.log(`  • 考试地点: ${item.examLocation || '未提取'}`);
    console.log(`  • 薪资范围: ${item.salaryRange || '未提取'}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

testExtractor().catch(console.error);
