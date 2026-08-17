/**
 * 拆分大型 SQL 文件
 * 将 import-data.sql 拆分为多个小文件
 */

import { readFileSync, writeFileSync } from 'fs';

const inputFile = './output/import-data.sql';
const outputPrefix = './output/import-data-part-';
const linesPerFile = 200; // 每个文件 200 条 INSERT 语句

console.log('读取 SQL 文件...');
const content = readFileSync(inputFile, 'utf-8');
const lines = content.split('\n').filter(line => line.trim());

console.log(`总行数: ${lines.length}`);

// 分离注释和 INSERT 语句
const comments = [];
const inserts = [];

for (const line of lines) {
  if (line.startsWith('--')) {
    comments.push(line);
  } else if (line.startsWith('INSERT')) {
    inserts.push(line);
  }
}

console.log(`注释: ${comments.length} 行`);
console.log(`INSERT 语句: ${inserts.length} 条`);

// 计算需要拆分的文件数
const fileCount = Math.ceil(inserts.length / linesPerFile);
console.log(`将拆分为 ${fileCount} 个文件\n`);

// 拆分并写入文件
for (let i = 0; i < fileCount; i++) {
  const start = i * linesPerFile;
  const end = Math.min(start + linesPerFile, inserts.length);
  const chunk = inserts.slice(start, end);

  const outputFile = `${outputPrefix}${String(i + 1).padStart(2, '0')}.sql`;
  const outputContent = [
    '-- 考情监测系统 - 公告数据导入（分片）',
    `-- 第 ${i + 1}/${fileCount} 部分`,
    `-- 包含第 ${start + 1} 到第 ${end} 条数据`,
    '',
    ...chunk
  ].join('\n');

  writeFileSync(outputFile, outputContent);
  console.log(`✓ ${outputFile} (${chunk.length} 条)`);
}

console.log(`\n拆分完成！共 ${fileCount} 个文件`);
console.log('\n导入命令:');
for (let i = 1; i <= fileCount; i++) {
  const filename = `import-data-part-${String(i).padStart(2, '0')}.sql`;
  console.log(`npx wrangler d1 execute kaojing-db --file=../crawlers/output/${filename}`);
}
