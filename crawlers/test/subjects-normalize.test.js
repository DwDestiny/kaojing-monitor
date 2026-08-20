/**
 * 科目归一化强化测试（P1C 长尾归并，2026-08-20）
 * 覆盖：线上 38 种科目的归并结果（辅导员/思政/技能/业务岗位类长尾消除）
 * 运行：cd crawlers && /path/to/node --test test/subjects-normalize.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSubject } from '../rules-engine.js';

// ── 核心科目不回归 ──
test('核心科目保持标准名', () => {
  assert.equal(normalizeSubject('专业知识'), '专业知识');
  assert.equal(normalizeSubject('公共基础知识'), '公共基础知识');
  assert.equal(normalizeSubject('教育基础知识'), '教育基础知识');
  assert.equal(normalizeSubject('职业能力倾向测验'), '职业能力倾向测验');
  assert.equal(normalizeSubject('综合应用能力'), '综合应用能力');
  assert.equal(normalizeSubject('教育心理学'), '教育心理学');
  assert.equal(normalizeSubject('时事政治'), '时事政治');
  assert.equal(normalizeSubject('综合知识'), '综合知识');
  assert.equal(normalizeSubject('写作'), '写作');
  assert.equal(normalizeSubject('法律法规'), '法律法规');
});

// ── 辅导员类归并 → 辅导员知识 ──
test('辅导员类长尾归并 → 辅导员知识', () => {
  assert.equal(normalizeSubject('辅导员知识'), '辅导员知识');
  assert.equal(normalizeSubject('辅导员岗位业务知识'), '辅导员知识');
  assert.equal(normalizeSubject('高校辅导员综合能力测试'), '辅导员知识');
});

// ── 思想政治类归并 → 思想政治 ──
test('思想政治类归并 → 思想政治', () => {
  assert.equal(normalizeSubject('思想政治'), '思想政治');
  assert.equal(normalizeSubject('思想政治教育工作理论'), '思想政治');
});

// ── 业务/岗位/专业类归并 → 专业知识 ──
test('业务岗位专业类归并 → 专业知识', () => {
  assert.equal(normalizeSubject('专业技术知识'), '专业知识');
  assert.equal(normalizeSubject('业务知识'), '专业知识');
  assert.equal(normalizeSubject('业务能力'), '专业知识');
  assert.equal(normalizeSubject('岗位相关知识'), '专业知识');
  assert.equal(normalizeSubject('教师岗位知识'), '专业知识');
  assert.equal(normalizeSubject('工作业务相关知识'), '专业知识');
  assert.equal(normalizeSubject('学科知识'), '专业知识');
  assert.equal(normalizeSubject('招聘岗位相关学科的基础知识和应用能力'), '专业知识');
});

// ── 技能类归并 → 专业技能 ──
test('技能类归并 → 专业技能', () => {
  assert.equal(normalizeSubject('专业技能'), '专业技能');
  assert.equal(normalizeSubject('技能'), '专业技能');
  assert.equal(normalizeSubject('工作技能'), '专业技能');
});

// ── 教育理论类归并 → 教育基础知识 ──
test('教育理论类归并 → 教育基础知识', () => {
  assert.equal(normalizeSubject('教育学'), '教育基础知识');
  assert.equal(normalizeSubject('教育教学理论'), '教育基础知识');
});

// ── 其他长尾 ──
test('其他长尾归并', () => {
  assert.equal(normalizeSubject('常识'), '公共基础知识');
  assert.equal(normalizeSubject('综合素养'), '综合知识');
  assert.equal(normalizeSubject('综合素养测试'), '综合知识');
  assert.equal(normalizeSubject('基础知识'), '综合知识');
  assert.equal(normalizeSubject('基本理论'), '综合知识');
});

// ── 保留独立科目 ──
test('独立科目保留原样', () => {
  assert.equal(normalizeSubject('省情省况'), '省情省况');
  assert.equal(normalizeSubject('职业教育'), '职业教育');
  assert.equal(normalizeSubject('护理学'), '护理学');
  assert.equal(normalizeSubject('医学基础知识'), '医学基础知识');
});

// ── 合理归并（含教育/法律前缀的并入大类）──
test('教育法律前缀归并', () => {
  assert.equal(normalizeSubject('高等教育学'), '教育基础知识');
  assert.equal(normalizeSubject('教育法律法规'), '法律法规');
});
