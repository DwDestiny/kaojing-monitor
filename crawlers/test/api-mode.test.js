/**
 * JSON API 爬取模式单元测试（P1C，2026-08-20）
 * 覆盖：buildApiRequest（GET/POST/分页参数注入/浙江 paramJson）、
 *       parseJsonItems（JSON 数组响应 / HTML 字符串响应+cheerio）
 * 运行：cd crawlers && /path/to/node --test test/api-mode.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildApiRequest, parseJsonItems } from '../core/api-json.js';

// ── buildApiRequest：GET ──
test('buildApiRequest GET：apiParams 合并 + pageNum 注入', () => {
  const cfg = {
    apiUrl: 'https://x.gov.cn/api/list',
    apiMethod: 'GET',
    apiParams: { sectionId: '1006' },
  };
  const req = buildApiRequest(cfg, 2);
  assert.equal(req.method, 'GET');
  assert.equal(req.body, null);
  assert.match(req.url, /sectionId=1006/);
  assert.match(req.url, /pageNum=2/);
});

test('buildApiRequest GET：已有 ? 参数的 URL 用 & 连接', () => {
  const cfg = { apiUrl: 'https://x.gov.cn/api?type=1' };
  const req = buildApiRequest(cfg, 1);
  assert.match(req.url, /type=1&pageNum=1/);
});

test('buildApiRequest GET：paramJson 模板注入（浙江 jcms）', () => {
  const cfg = {
    apiUrl: 'https://rlsbt.zj.gov.cn/api-gateway/jpaas-publish-server/front/page/build/unit',
    apiMethod: 'GET',
    apiParams: { parseType: 'bulidstatic', webId: '2758', pageId: '1229743683' },
    paramJsonTemplate: { pageSize: 20 },
    paramJsonPageParam: 'pageNo',
  };
  const req = buildApiRequest(cfg, 3);
  assert.match(req.url, /parseType=bulidstatic/);
  assert.match(req.url, /pageId=1229743683/);
  assert.match(req.url, /paramJson=%7B%22pageSize%22%3A20%2C%22pageNo%22%3A3%7D/); // {"pageSize":20,"pageNo":3}
});

// ── buildApiRequest：POST ──
test('buildApiRequest POST：body 合并 + pageNum 注入（河北）', () => {
  const cfg = {
    apiUrl: 'https://rst.hebei.gov.cn/rsmhapi/door/listArticleByTab',
    apiMethod: 'POST',
    apiBody: { sectionId: 1006, pageSize: 20 },
  };
  const req = buildApiRequest(cfg, 2);
  assert.equal(req.method, 'POST');
  assert.equal(req.headers['Content-Type'], 'application/json');
  const body = JSON.parse(req.body);
  assert.equal(body.sectionId, 1006);
  assert.equal(body.pageNum, 2);
  assert.equal(body.pageSize, 20);
});

// ── parseJsonItems：形态 A（JSON 数组）──
test('parseJsonItems：itemsPath 数组路径', () => {
  const data = {
    data: {
      list: [
        { title: '公告A', url: '/a.html', publishDate: '2026-08-01' },
        { title: '公告B', url: 'https://x.gov.cn/b.html', publishDate: '2026-08-02' },
      ],
    },
  };
  const cfg = { itemsPath: 'data.list', baseUrl: 'https://x.gov.cn/', name: '测试', region: '测试省' };
  const items = parseJsonItems(data, cfg);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, '公告A');
  assert.equal(items[0].url, 'https://x.gov.cn/a.html');
  assert.equal(items[1].publishDate, '2026-08-02');
});

test('parseJsonItems：字段兼容（name/link/pubDate）', () => {
  const data = { list: [{ name: '公告C', link: '/c.html', pubDate: '2026/08/03' }] };
  const cfg = { itemsPath: 'list', baseUrl: 'https://x.gov.cn/' };
  const items = parseJsonItems(data, cfg);
  assert.equal(items[0].title, '公告C');
  assert.equal(items[0].publishDate, '2026-08-03');
});

test('parseJsonItems：items 为空或非数组返回 []', () => {
  assert.deepEqual(parseJsonItems({ data: { list: [] } }, { itemsPath: 'data.list' }), []);
  assert.deepEqual(parseJsonItems({}, { itemsPath: 'data.list' }), []);
});

test('parseJsonItems：urlTemplate 模板拼装（河北 pageWarp?isId）', () => {
  const data = {
    data: {
      rows: [
        { id: 'abc123', title: '河北招聘公告', publishedDate: '2026-08-01 10:00:00', articleContent: '<p>正文</p>' },
      ],
    },
  };
  const cfg = {
    itemsPath: 'data.rows',
    urlTemplate: 'https://rst.hebei.gov.cn/pageWarp?isId={id}',
    baseUrl: 'https://rst.hebei.gov.cn',
    name: '河北', region: '河北',
  };
  const items = parseJsonItems(data, cfg);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, '河北招聘公告');
  assert.equal(items[0].url, 'https://rst.hebei.gov.cn/pageWarp?isId=abc123');
  assert.equal(items[0].publishDate, '2026-08-01');
  assert.match(items[0].rawHtml, /正文/);
});

test('parseJsonItems：publishedDate 字段兼容（河北）', () => {
  const data = { rows: [{ id: 'x', title: '公告', publishedDate: '2026-08-02 09:30:00' }] };
  const cfg = { itemsPath: 'rows', urlTemplate: 'https://x.gov.cn/d?id={id}' };
  const items = parseJsonItems(data, cfg);
  assert.equal(items[0].publishDate, '2026-08-02');
});

// ── parseJsonItems：形态 B（HTML 字符串 + cheerio）──
test('parseJsonItems：htmlPath + cheerio 解析 li（浙江 jcms）', () => {
  const data = {
    data: {
      html: '<ul><li><a class="bt_link" title="浙江公告1">浙江公告1</a><span class="bt_time">2026-08-19</span></li><li><a class="bt_link" href="/art/2.html" title="浙江公告2">浙江公告2</a><span class="bt_time">2026-08-18</span></li></ul>',
    },
  };
  const cfg = {
    htmlPath: 'data.html',
    itemContainer: 'li',
    titleSelector: 'a.bt_link',
    urlSelector: 'a.bt_link',
    urlAttr: 'href',
    dateSelector: 'span.bt_time',
    baseUrl: 'https://rlsbt.zj.gov.cn/',
    name: '浙江', region: '浙江',
  };
  const items = parseJsonItems(data, cfg);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, '浙江公告1');
  assert.equal(items[0].publishDate, '2026-08-19');
  // 无 href 的条目 URL 为空（真实数据中 bt_link 可能无 href，由详情页另行获取）
  assert.equal(items[1].url, 'https://rlsbt.zj.gov.cn/art/2.html');
});

test('parseJsonItems：htmlPath 为空返回 []', () => {
  const items = parseJsonItems({ data: {} }, { htmlPath: 'data.html', itemContainer: 'li' });
  assert.deepEqual(items, []);
});

// ── 配置校验 ──
test('parseJsonItems：无 itemsPath 且无 htmlPath 抛错', () => {
  assert.throws(() => parseJsonItems({}, { name: 'x' }), /itemsPath|htmlPath/);
});
