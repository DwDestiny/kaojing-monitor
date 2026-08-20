/**
 * T1：GET /api/subjects 测试
 * 需求：从 announcements.exam_subjects（逗号分隔串）派生科目，去重、计数、排序
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeDb, apiRequest } from './helpers.js';

// 构造 subjects 场景的 env（mock D1 的 all() 返回指定行）
function makeEnv(rows) {
  const db = makeDb({
    script: [{ all: () => ({ results: rows }) }],
  });
  return { DB: db, ALLOWED_ORIGINS: '' };
}

test('T1-1 正常：多行科目 → 返回去重数组', async () => {
  const res = await worker.fetch(
    apiRequest('/api/subjects'),
    makeEnv([
      { exam_subjects: '公共基础知识,专业知识' },
      { exam_subjects: '职业能力倾向测验' },
    ]),
    {}
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(Array.isArray(json.data));
  assert.equal(json.data.length, 3);
});

test('T1-2 空库：返回 []', async () => {
  const res = await worker.fetch(apiRequest('/api/subjects'), makeEnv([]), {});
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json.data, []);
});

test('T1-3 逗号拆分："公共基础知识,专业知识" → 两项', async () => {
  const res = await worker.fetch(
    apiRequest('/api/subjects'),
    makeEnv([{ exam_subjects: '公共基础知识,专业知识' }]),
    {}
  );
  const json = await res.json();
  assert.equal(json.data.length, 2);
  // 拆分后两项均存在（输出按码点升序：专 U+4E13 < 公 U+516C）
  assert.deepEqual(
    [...json.data.map(x => x.name)].sort(),
    ['公共基础知识', '专业知识'].sort()
  );
});

test('T1-4 去重：重复科目只出现一次', async () => {
  const res = await worker.fetch(
    apiRequest('/api/subjects'),
    makeEnv([
      { exam_subjects: '数学,英语' },
      { exam_subjects: '数学' },
    ]),
    {}
  );
  const json = await res.json();
  assert.equal(json.data.length, 2);
  assert.deepEqual(
    json.data.map(x => x.name),
    ['数学', '英语']
  );
});

test('T1-5 排序：稳定输出（Unicode 码点升序）', async () => {
  const res = await worker.fetch(
    apiRequest('/api/subjects'),
    makeEnv([
      { exam_subjects: '语文,英语' },
      { exam_subjects: '数学,英语' },
    ]),
    {}
  );
  const json = await res.json();
  // 码点：数(0x6570) < 英(0x82F1) < 语(0x8BED)，排序需确定
  assert.deepEqual(
    json.data.map(x => x.name),
    ['数学', '英语', '语文']
  );
});

test('T1-6 响应格式 { data: [{name, count}] }（含出现次数）', async () => {
  const res = await worker.fetch(
    apiRequest('/api/subjects'),
    makeEnv([
      { exam_subjects: '数学,英语' },
      { exam_subjects: '数学' },
    ]),
    {}
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json.data[0], { name: '数学', count: 2 });
  assert.deepEqual(json.data[1], { name: '英语', count: 1 });
});
