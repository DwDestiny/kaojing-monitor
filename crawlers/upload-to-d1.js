/**
 * 自动上传脚本：读取爬虫产物 → 规则引擎清洗 → POST 到 Worker /api/import 写库
 *
 * 设计：GitHub Actions 定时爬虫的最后一步调用本脚本（crawler.yml），
 * 数据经 /api/import 端点进入 Worker 的 D1 binding 直写 announcements 表，
 * 全程无需 wrangler 凭证（凭证在 Worker 部署侧，见 wrangler.toml d1_databases）。
 *
 * 用法：
 *   AI_API_TOKEN=xxx node upload-to-d1.js [input.json]
 *   input 默认 ./output/processed-data.json（process.js 产物）
 *
 * 环境变量：
 *   AI_API_TOKEN  必填，调用 /api/import 的 Bearer token（与 AI 提取共用）
 *   API_BASE      可选，默认 https://kaojing-monitor.pages.dev
 */

import { readFileSync } from 'fs';
import { autoFix } from './rules-engine.js';

const API_BASE = process.env.API_BASE || 'https://kaojing-monitor.pages.dev';
const TOKEN = process.env.AI_API_TOKEN;
const INPUT = process.env.INPUT_JSON || process.argv[2] || './output/processed-data.json';

if (!TOKEN) {
  console.error('❌ 缺少 AI_API_TOKEN 环境变量（调用 /api/import 需要 Bearer token）');
  process.exit(1);
}

// 1. 读取爬虫产物
const data = JSON.parse(readFileSync(INPUT, 'utf-8'));
console.log(`读取数据: ${data.length} 条（${INPUT}）`);

// 2. 规则引擎清洗（零人工：deadline/examDate/type/count/subjects 自动校验修复）
let totalChanges = 0;
for (const item of data) {
  const changes = autoFix(item);
  totalChanges += changes.length;
}
console.log(`规则引擎清洗完成: ${totalChanges} 处字段修正`);

// 3. 提取上传所需字段（去掉无关中间字段，控制请求体大小）
const items = data.map((item) => ({
  title: item.title,
  url: item.url,
  urlHash: item.urlHash,
  contentHash: item.contentHash,
  source: item.source,
  region: item.region,
  recruitCount: item.recruitCount,
  examDate: item.examDate,
  examTime: item.examTime,
  examSubjects: item.examSubjects,
  examType: item.examType,
  examLocation: item.examLocation,
  registrationDeadline: item.registrationDeadline,
  salaryRange: item.salaryRange,
  publishDate: item.publishDate,
  examNote: item.examNote,
  crawledAt: item.crawledAt || item.crawled_at,
  rawHtml: item.rawHtml,
  complianceLevel: item.complianceLevel,
  isKnown: item.is_known || item.isKnown,
}));

// 4. POST /api/import（分片上传，每片 100 条，避免请求体过大）
const IMPORT_URL = `${API_BASE}/api/import`;
let totalImported = 0;
let totalSkipped = 0;

for (let i = 0; i < items.length; i += 100) {
  const chunk = items.slice(i, i + 100);
  console.log(`上传第 ${i / 100 + 1} 批（${chunk.length} 条）...`);

  const resp = await fetch(IMPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ items: chunk }),
  });

  const result = await resp.json();
  if (!resp.ok) {
    console.error(`❌ 上传失败 HTTP ${resp.status}:`, result.error || result);
    process.exit(1);
  }

  totalImported += result.imported || 0;
  totalSkipped += (result.skipped || []).length;
  console.log(`  批次结果: 新增 ${result.imported} 条, 重复跳过 ${(result.total || 0) - (result.imported || 0)} 条`);
}

console.log('\n===== 上传完成 =====');
console.log(`总条数: ${data.length}`);
console.log(`新增入库: ${totalImported} 条`);
console.log(`跳过: ${totalSkipped} 条（缺 title/url）`);
console.log(`重复（INSERT OR IGNORE 自动去重）: ${data.length - totalImported - totalSkipped} 条`);
