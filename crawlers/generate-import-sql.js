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
      item.examSubjects?.length > 0 ? escapeSql(item.examSubjects.join(',')) : 'NULL',
      escapeSql(item.examType),
      'NULL', // exam_category
      escapeSql(item.examLocation),
      escapeSql(item.registrationDeadline),
      escapeSql(item.salaryRange),
      escapeSql(item.publishDate),
      escapeSql(item.crawled_at || new Date().toISOString()),
      escapeSql(new Date().toISOString()), // extracted_at
      escapeSql('active'),
      'NULL' // raw_html 太大，暂不导入
    ];

    sql.push(
      `INSERT OR IGNORE INTO announcements (title, url, url_hash, content_hash, source_website_id, source, region, recruit_count, exam_date, exam_time, exam_subjects, exam_type, exam_category, exam_location, registration_deadline, salary_range, publish_date, crawled_at, extracted_at, status, raw_html) VALUES (${values.join(', ')});`
    );
  }

  return sql.join('\n');
}

/**
 * 主函数
 */
function main() {
  console.log('读取处理后的数据...');

  const inputPath = './output/processed-data.json';
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
