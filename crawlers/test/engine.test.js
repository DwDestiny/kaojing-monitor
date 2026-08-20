/**
 * engine.js 扩源能力单元测试（P1 扩源，2026-08-20）
 * 覆盖：buildPageUrl（静态/参数分页、页码偏移、offset 步进）、decodeHtml（GBK）、
 *       extractDate（多元素拼接/日期兜底）、parseDate（方括号/长文本/拆分年+月日）
 * 运行：cd crawlers && /path/to/node --test test/engine.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';

import { buildPageUrl, decodeHtml, extractDate } from '../core/engine.js';
import { parseDate } from '../core/utils.js';

// ── buildPageUrl：静态分页 ──
test('buildPageUrl 静态分页：第1页用列表URL，第2页替换 index_{page}', () => {
  const cfg = {
    listPageUrl: 'https://x.gov.cn/col/index.html',
    paginationType: 'static-file',
    paginationPattern: 'index_{page}.html',
  };
  assert.equal(buildPageUrl(cfg, 1), 'https://x.gov.cn/col/index.html');
  assert.equal(buildPageUrl(cfg, 2), 'https://x.gov.cn/col/index_2.html');
  assert.equal(buildPageUrl(cfg, 3), 'https://x.gov.cn/col/index_3.html');
});

test('buildPageUrl 静态分页：pageOffset=-1（贵州/湖北 createPageHTML 第2页为 index_1）', () => {
  const cfg = {
    listPageUrl: 'https://x.gov.cn/col/index.html',
    paginationType: 'static-file',
    paginationPattern: 'index_{page}.html',
    pageOffset: -1,
  };
  assert.equal(buildPageUrl(cfg, 1), 'https://x.gov.cn/col/index.html');
  assert.equal(buildPageUrl(cfg, 2), 'https://x.gov.cn/col/index_1.html');
  assert.equal(buildPageUrl(cfg, 3), 'https://x.gov.cn/col/index_2.html');
});

test('buildPageUrl 静态分页：list_{page}.shtml 变体（新疆）', () => {
  const cfg = {
    listPageUrl: 'https://x.gov.cn/c112746/list.shtml',
    paginationType: 'static-file',
    paginationPattern: 'list_{page}.shtml',
  };
  assert.equal(buildPageUrl(cfg, 2), 'https://x.gov.cn/c112746/list_2.shtml');
});

// ── buildPageUrl：参数分页 ──
test('buildPageUrl 参数分页：默认 ?page=N', () => {
  const cfg = {
    listPageUrl: 'https://x.gov.cn/NewsLsit.aspx?ClassID=602',
    paginationType: 'url-param',
  };
  assert.equal(buildPageUrl(cfg, 1), 'https://x.gov.cn/NewsLsit.aspx?ClassID=602');
  // 已有 ? 参数时用 & 连接
  assert.equal(buildPageUrl(cfg, 2), 'https://x.gov.cn/NewsLsit.aspx?ClassID=602&page=2');
});

test('buildPageUrl 参数分页：paginationParamName=offset + paginationStep=30（河南）', () => {
  const cfg = {
    listPageUrl: 'https://x.gov.cn/viewCmsCac.do?cacId=abc',
    paginationType: 'url-param',
    paginationParamName: 'offset',
    paginationStep: 30,
  };
  assert.equal(buildPageUrl(cfg, 1), 'https://x.gov.cn/viewCmsCac.do?cacId=abc');
  assert.equal(buildPageUrl(cfg, 2), 'https://x.gov.cn/viewCmsCac.do?cacId=abc&offset=30');
  assert.equal(buildPageUrl(cfg, 3), 'https://x.gov.cn/viewCmsCac.do?cacId=abc&offset=60');
});

test('buildPageUrl 参数分页：无 ? 的 URL 用 ? 连接（北京机关）', () => {
  const cfg = { listPageUrl: 'https://x.gov.cn/Notice.html', paginationType: 'url-param' };
  assert.equal(buildPageUrl(cfg, 2), 'https://x.gov.cn/Notice.html?page=2');
});

// ── decodeHtml：编码 ──
test('decodeHtml utf-8 正常解码', () => {
  const buf = Buffer.from('<li>招聘公告</li>', 'utf-8');
  assert.equal(decodeHtml(buf, 'utf-8'), '<li>招聘公告</li>');
});

test('decodeHtml gbk 解码（全国事业单位招聘网）', () => {
  const text = '2026年招聘公告测试';
  // 用 gbk 编码构造 Buffer（TextEncoder 只有 utf-8，用 iconv 不可用 → 用 Buffer.from 手动 gbk 字节）
  const gbkBytes = Buffer.from([
    0x32, 0x30, 0x32, 0x36, 0xc4, 0xea, 0xd5, 0xd0, 0xc6, 0xb8, 0xb9, 0xab, 0xb8, 0xe6, 0xb2, 0xe2, 0xca, 0xd4,
  ]);
  const decoded = decodeHtml(gbkBytes, 'gbk');
  assert.equal(decoded, text);
});

test('decodeHtml gb2312 也按 gbk 解码', () => {
  const gbkBytes = Buffer.from([0xc4, 0xea]); // "年"
  assert.equal(decodeHtml(gbkBytes, 'gb2312'), '年');
});

// ── extractDate ──
test('extractDate 单元素选择器', () => {
  const $ = cheerio.load('<li><a>公告</a><span class="time">2026-08-14</span></li>');
  const $item = $('li');
  assert.equal(extractDate($, $item, 'span.time', null), '2026-08-14');
});

test('extractDate 多元素拼接（辽宁 年+月日）', () => {
  const $ = cheerio.load('<div class="k"><div class="y">2026</div><div class="md">07-21</div><a>公告</a></div>');
  const $item = $('div.k');
  assert.equal(extractDate($, $item, 'div.y|div.md', null), '2026-07-21');
});

test('extractDate 长文本日期（海南 发布时间：2026-08-14）', () => {
  const $ = cheerio.load('<table><tr><td>发布时间：2026-08-14</td></tr></table>');
  const $item = $('table');
  assert.equal(extractDate($, $item, 'table tr td', null), '2026-08-14');
});

test('extractDate defaultDate=today 兜底（四川专题页无日期）', () => {
  const $ = cheerio.load('<div class="item"><a>公告</a></div>');
  const $item = $('div.item');
  const today = new Date().toISOString().split('T')[0];
  assert.equal(extractDate($, $item, null, 'today'), today);
});

test('extractDate 无日期且无兜底返回空串', () => {
  const $ = cheerio.load('<div><a>公告</a></div>');
  assert.equal(extractDate($, $('div'), null, null), '');
});

// ── parseDate 增强 ──
test('parseDate 标准格式原样返回', () => {
  assert.equal(parseDate('2026-08-17'), '2026-08-17');
});

test('parseDate 方括号日期（吉林/广西）', () => {
  assert.equal(parseDate('[2026-08-06]'), '2026-08-06');
});

test('parseDate 长文本中提取（河南 [2026-07-10] 在 td 内）', () => {
  assert.equal(parseDate(' [2026-07-10] '), '2026-07-10');
});

test('parseDate 斜杠/点分隔', () => {
  assert.equal(parseDate('2026/8/17'), '2026-08-17');
  assert.equal(parseDate('2026.08.17'), '2026-08-17');
});

test('parseDate 拆分年+月日拼接串（辽宁 "202607-21"）', () => {
  assert.equal(parseDate('202607-21'), '2026-07-21');
});

test('parseDate 纯年份不误解析', () => {
  assert.equal(parseDate('2026'), '2026');
});
