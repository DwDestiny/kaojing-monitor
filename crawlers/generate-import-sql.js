/**
 * 数据导入脚本
 * 将处理后的 JSON 数据转换为 SQL 插入语句
 */

import { readFileSync, writeFileSync } from 'fs';

/**
 * 转义 SQL 字符串
 */
function escapeSql(str) {
  if (!str) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

/**
 * 生成公告插入 SQL
 */
function generateAnnouncementsSql(data) {
  const sql = [];

  sql.push('-- 导入公告数据');
  sql.push('-- 共 ' + data.length + ' 条\n');

  for (const item of data) {
    // 受限源（compliance_level=restricted）只存 snippet（前 2000 字符），普通源存完整正文（截断 100KB）
    // 注意：item.rawHtml 可能不存在（undefined），用 || '' 兜底；空串经 escapeSql 会转成 NULL
    const rawHtmlVal = item.complianceLevel === 'restricted'
      ? escapeSql((item.rawHtml || '').slice(0, 2000))
      : escapeSql((item.rawHtml || '').slice(0, 100000));

    // crawled_at 优先用真实爬取时间 item.crawledAt（兼容旧字段 crawled_at），缺失才兜底当前时间
    const crawledAtVal = escapeSql(item.crawledAt || item.crawled_at || new Date().toISOString());

    // TODO(compliance_level)：schema 迁移后启用该列，取值 escapeSql(item.complianceLevel || 'safe')，
    // 当前 schema 尚无 compliance_level 列，先不加避免 SQL 报错。

    const values = [
      escapeSql(item.title),
      escapeSql(item.url),
      escapeSql(item.urlHash),
      escapeSql(item.contentHash),
      'NULL', // source_website_id，后续关联
      escapeSql(item.source),
      escapeSql(item.region),
      item.recruitCount || 'NULL',
      escapeSql(item.examDate),
      escapeSql(item.examTime),
      Array.isArray(item.examSubjects) && item.examSubjects.length > 0 ? escapeSql(item.examSubjects.join(',')) : (typeof item.examSubjects === 'string' && item.examSubjects ? escapeSql(item.examSubjects) : 'NULL'),
      escapeSql(item.examType),
      'NULL', // exam_category
      escapeSql(item.examLocation),
      escapeSql(item.registrationDeadline),
      escapeSql(item.salaryRange),
      escapeSql(item.publishDate),
      escapeSql(item.examNote), // 笔试状态：'免笔试' 或 NULL
      crawledAtVal, // 真实爬取时间（不再统一用当前时间）
      escapeSql(new Date().toISOString()), // extracted_at
      escapeSql('active'),
      rawHtmlVal // raw_html 实际入库（受限源 snippet / 普通源截断 100KB）
    ];

    sql.push(
      `INSERT OR IGNORE INTO announcements (title, url, url_hash, content_hash, source_website_id, source, region, recruit_count, exam_date, exam_time, exam_subjects, exam_type, exam_category, exam_location, registration_deadline, salary_range, publish_date, exam_note, crawled_at, extracted_at, status, raw_html) VALUES (${values.join(', ')});`
    );
  }

  return sql.join('\n');
}

/**
 * 主函数
 */
function main() {
  console.log('读取处理后的数据...');

  // 支持通过环境变量指定输入文件（默认 processed-data.json；Ollama 重提取结果用 re-extracted-ollama.json）
  const inputPath = process.env.INPUT_JSON || './output/processed-data.json';
  const data = JSON.parse(readFileSync(inputPath, 'utf-8'));

  console.log(`数据条数: ${data.length}`);

  console.log('生成 SQL...');
  const sql = generateAnnouncementsSql(data);

  const outputPath = './output/import-data.sql';
  writeFileSync(outputPath, sql);

  console.log(`SQL 已保存到: ${outputPath}`);
  console.log(`文件大小: ${(sql.length / 1024).toFixed(2)} KB`);
}

main();
