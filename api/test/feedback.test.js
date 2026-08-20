/**
 * T2：/api/feedback 扩展 + IP 限频测试
 * 需求：备注提交（announcement_id 绑定）、contact 落库、同 IP 60 秒限频
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeDb, apiRequest } from './helpers.js';

function makeEnv(db) {
  return { DB: db, ALLOWED_ORIGINS: '' };
}

// 正常流程：第 1 步限频查询（无记录），第 2 步 INSERT
function normalDb() {
  return makeDb({
    script: [
      { first: () => null },
      { run: () => ({ meta: { changes: 1 }, results: [] }) },
    ],
  });
}

test('T2-1 正常提交 {type, content, announcement_id} → 200 成功', async () => {
  const db = normalDb();
  const res = await worker.fetch(
    apiRequest('/api/feedback', {
      method: 'POST',
      body: { type: 'data_error', content: '公告信息有误', announcement_id: 123 },
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    }),
    makeEnv(db),
    {}
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
});

test('T2-2 缺 content → 400', async () => {
  const res = await worker.fetch(
    apiRequest('/api/feedback', {
      method: 'POST',
      body: { type: 'data_error' },
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    }),
    makeEnv(makeDb()),
    {}
  );
  assert.equal(res.status, 400);
});

test('T2-3 type 非法 → 400', async () => {
  const res = await worker.fetch(
    apiRequest('/api/feedback', {
      method: 'POST',
      body: { type: 'hack', content: 'x' },
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    }),
    makeEnv(makeDb()),
    {}
  );
  assert.equal(res.status, 400);
});

test('T2-4 content > 2000 字 → 400', async () => {
  const res = await worker.fetch(
    apiRequest('/api/feedback', {
      method: 'POST',
      body: { type: 'other', content: '字'.repeat(2001) },
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    }),
    makeEnv(makeDb()),
    {}
  );
  assert.equal(res.status, 400);
});

test('T2-5 同 IP 60 秒内重复 → 429', async () => {
  // 限频查询命中：60 秒内已有同 IP 记录
  const db = makeDb({
    script: [{ first: () => ({ id: 1 }) }],
  });
  const res = await worker.fetch(
    apiRequest('/api/feedback', {
      method: 'POST',
      body: { type: 'data_error', content: '重复提交' },
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    }),
    makeEnv(db),
    {}
  );
  assert.equal(res.status, 429);
});

test('T2-6 不同 IP → 放行', async () => {
  const db = normalDb();
  const res = await worker.fetch(
    apiRequest('/api/feedback', {
      method: 'POST',
      body: { type: 'data_error', content: '另一 IP 提交' },
      headers: { 'CF-Connecting-IP': '5.6.7.8' },
    }),
    makeEnv(db),
    {}
  );
  assert.equal(res.status, 200);
});

test('T2-7 announcement_id/contact/ip 正确落库', async () => {
  const db = normalDb();
  await worker.fetch(
    apiRequest('/api/feedback', {
      method: 'POST',
      body: {
        type: 'feature_request',
        content: '希望增加科目筛选',
        contact: 'test@example.com',
        announcement_id: 42,
      },
      headers: { 'CF-Connecting-IP': '9.9.9.9' },
    }),
    makeEnv(db),
    {}
  );

  // 第 2 次 prepare().bind() 是 INSERT（第 1 次是限频查询）
  const insertCall = db.calls[1];
  assert.ok(insertCall.sql.includes('announcement_id'), 'INSERT 应含 announcement_id 列');
  assert.ok(insertCall.sql.includes('contact'), 'INSERT 应含 contact 列');
  assert.ok(insertCall.sql.includes('ip'), 'INSERT 应含 ip 列');

  // INSERT VALUES 顺序：type, content, email, contact, ip, announcement_id, created_at
  const [type, content, email, contact, ip, announcementId] = insertCall.args;
  assert.equal(type, 'feature_request');
  assert.equal(content, '希望增加科目筛选');
  assert.equal(email, null);
  assert.equal(contact, 'test@example.com');
  assert.equal(ip, '9.9.9.9');
  assert.equal(announcementId, 42);
});
