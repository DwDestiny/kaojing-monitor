// T0 冒烟测试：验证 node:test 基建可用
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('smoke: 测试基建可用', () => {
  assert.equal(1 + 1, 2);
});
