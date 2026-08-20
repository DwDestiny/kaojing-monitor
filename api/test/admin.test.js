/**
 * T3：/api/admin/verify + 反馈管理测试
 * 需求：口令验证（错误 5 次锁 10 分钟）、x-admin-key 凭证访问反馈列表、更新状态
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import worker, { __resetAdminLockForTest } from '../src/index.js';
import { makeDb, apiRequest } from './helpers.js';

const ADMIN_PASSWORD = 'dangwei121105';

function makeEnv(db) {
  return { DB: db, ADMIN_PASSWORD, ALLOWED_ORIGINS: '' };
}

before(() => __resetAdminLockForTest());
after(() => __resetAdminLockForTest());

test('T3-1 POST /api/admin/verify 口令正确 → {ok:true}', async () => {
  const res = await worker.fetch(
    apiRequest('/api/admin/verify', {
      method: 'POST',
      body: { password: ADMIN_PASSWORD },
      headers: { 'CF-Connecting-IP': '10.0.0.1' },
    }),
    makeEnv(makeDb()),
    {}
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json, { ok: true });
});

test('T3-2 口令错误 → 401', async () => {
  const res = await worker.fetch(
    apiRequest('/api/admin/verify', {
      method: 'POST',
      body: { password: 'wrong-password' },
      headers: { 'CF-Connecting-IP': '10.0.0.2' },
    }),
    makeEnv(makeDb()),
    {}
  );
  assert.equal(res.status, 401);
});

test('T3-3 错误 5 次 → 锁 10 分钟（第 6 次即使口令对也 429）', async () => {
  const env = makeEnv(makeDb());

  // 连续 5 次错误口令（每次新建 Request，body 流不可复用）
  for (let i = 0; i < 5; i++) {
    const res = await worker.fetch(
      apiRequest('/api/admin/verify', {
        method: 'POST',
        body: { password: 'wrong' },
        headers: { 'CF-Connecting-IP': '10.0.0.3' },
      }),
      env,
      {}
    );
    assert.equal(res.status, 401, `第 ${i + 1} 次应 401`);
  }

  // 第 6 次：口令正确也应被锁 → 429
  const res = await worker.fetch(
    apiRequest('/api/admin/verify', {
      method: 'POST',
      body: { password: ADMIN_PASSWORD },
      headers: { 'CF-Connecting-IP': '10.0.0.3' },
    }),
    env,
    {}
  );
  assert.equal(res.status, 429);
});

test('T3-4 GET /api/admin/feedback 无 admin 凭证 → 401', async () => {
  const res = await worker.fetch(
    apiRequest('/api/admin/feedback'),
    makeEnv(makeDb()),
    {}
  );
  assert.equal(res.status, 401);
});

test('T3-5 带凭证 → 返回反馈列表（含公告标题/时间/类型/状态/内容）', async () => {
  const db = makeDb({
    script: [
      {
        all: () => ({
          results: [
            {
              id: 1,
              type: 'data_error',
              content: '公告内容有误',
              status: 'pending',
              created_at: '2026-08-20T10:00:00Z',
              processed_at: null,
              email: null,
              contact: null,
              ip: '1.1.1.1',
              announcement_id: 5,
              title: '2026年某市事业单位招聘公告',
            },
          ],
        }),
      },
    ],
  });
  const res = await worker.fetch(
    apiRequest('/api/admin/feedback', {
      headers: { 'x-admin-key': ADMIN_PASSWORD },
    }),
    makeEnv(db),
    {}
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.length, 1);
  const row = json.data[0];
  assert.equal(row.title, '2026年某市事业单位招聘公告');
  assert.equal(row.announcementId, 5);
  assert.equal(row.createdAt, '2026-08-20T10:00:00Z');
  assert.equal(row.type, 'data_error');
  assert.equal(row.status, 'pending');
  assert.equal(row.content, '公告内容有误');
  assert.equal(row.ip, '1.1.1.1');
});

test('T3-6 POST /api/admin/feedback/:id/status 更新状态生效', async () => {
  const db = makeDb({
    script: [{ run: () => ({ meta: { changes: 1 } }) }],
  });
  const res = await worker.fetch(
    apiRequest('/api/admin/feedback/3/status', {
      method: 'POST',
      body: { status: 'resolved' },
      headers: { 'x-admin-key': ADMIN_PASSWORD },
    }),
    makeEnv(db),
    {}
  );
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);

  const updateCall = db.calls[0];
  assert.ok(updateCall.sql.includes('status'), 'UPDATE 应含 status 列');
  assert.ok(updateCall.sql.includes('processed_at'), 'UPDATE 应更新 processed_at');
  assert.equal(updateCall.args[0], 'resolved');
  assert.equal(updateCall.args[1], 3);
});
