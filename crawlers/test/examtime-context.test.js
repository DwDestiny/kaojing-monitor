/**
 * examTime 语境校验测试（规则7.5，LLM 幻觉修复 2026-08-20）
 * 咨询时间/报名时间不是笔试时间；免笔试公告无笔试时间
 * 运行：cd crawlers && /path/to/node --test test/examtime-context.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { autoFix } from '../rules-engine.js';

test('咨询时间不提取为笔试时间（浙江案例）', () => {
  const item = {
    title: '浙江省文物考古研究所2026年公开招聘人员公告',
    examTime: '9:00-11:30',
    rawHtml: '（四）有关本次招聘工作具体问题，请向招聘单位直接咨询。咨询时间：工作日上午9:00-11:30，下午13:30-16:30。咨询电话：0571-88038198',
    publishDate: '2026-08-20',
  };
  autoFix(item);
  assert.equal(item.examTime, null);
});

test('报名时间不提取为笔试时间（吉林案例）', () => {
  const item = {
    title: '吉林省省直事业单位公开招聘工作人员公告（9号）',
    examTime: '9:00-16:00',
    rawHtml: '（二）报名时间 2026年7月13日至7月17日，9:00-16:00（工作日受理报名资格审查）。',
    publishDate: '2026-07-08',
  };
  autoFix(item);
  assert.equal(item.examTime, null);
});

test('真实笔试时间保留', () => {
  const item = {
    title: '某某事业单位公开招聘公告',
    examTime: '9:00-11:30',
    rawHtml: '（三）笔试 笔试时间：2026年8月20日上午9:00-11:30，地点见准考证。',
    publishDate: '2026-07-20',
  };
  autoFix(item);
  assert.equal(item.examTime, '9:00-11:30');
});

test('免笔试公告的笔试时间清除', () => {
  const item = {
    title: '某某考核招聘公告',
    examTime: '9:00-16:00',
    examNote: '免笔试',
    rawHtml: '考试采取免笔试的方式进行，由招聘单位自行负责组织实施。面试时间另行通知。',
    publishDate: '2026-07-01',
  };
  autoFix(item);
  assert.equal(item.examTime, null);
});

test('免笔试判定含田野实操/直接面试模式（浙江考古案例）', () => {
  const item = {
    title: '浙江省文物考古研究所2026年公开招聘人员公告',
    rawHtml: '（三）考试 1.考试方式与成绩计算 田野考古A、B、C、D岗位采用面试、田野实操测评相结合的方式。面试、田野实操测评满分为100分，并各按50%计入总成绩。考古期刊编辑岗位采用直接面试的方式，面试满分为100分。',
    publishDate: '2026-08-20',
  };
  autoFix(item);
  assert.equal(item.examNote, '免笔试');
});
