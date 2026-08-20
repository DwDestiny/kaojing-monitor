/**
 * 规则9/10/7.5扩展测试（2026-08-20 全量审计后治本）
 * 规则9: examType 医院/学校主体细分
 * 规则10: publishDate 落款日期兜底（列表无日期时）
 * 规则7.5扩展: 技术支持/监督电话/资格初审时间非笔试
 * 运行：cd crawlers && /path/to/node --test test/rules-audit-fix.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { autoFix } from '../rules-engine.js';

// ── 规则9: examType 细分 ──
test('规则9: 医院主体标事业单位 → 医疗卫生', () => {
  const item = {
    title: '南方医科大学中西医结合医院2026年公开招聘专业技术人员公告',
    examType: '事业单位',
    rawHtml: '南方医科大学中西医结合医院是集医疗、教学、科研于一体的三级甲等医院……招聘岗位为专业技术人员。',
    publishDate: '2026-06-01',
  };
  autoFix(item);
  assert.equal(item.examType, '医疗卫生');
});

test('规则9: 学校主体标事业单位 → 教师招聘', () => {
  const item = {
    title: '山东师范大学附属中学2026年公开招聘教师公告',
    examType: '事业单位',
    rawHtml: '山东师范大学附属中学面向社会公开招聘教师岗位……',
    publishDate: '2026-06-01',
  };
  autoFix(item);
  assert.equal(item.examType, '教师招聘');
});

test('规则9: 泛称统考不细分（市属事业单位统考）', () => {
  const item = {
    title: '2026年上半年XX市事业单位公开招聘工作人员公告',
    examType: '事业单位',
    rawHtml: '本次统考面向全市事业单位岗位……含市属医院、学校等单位。',
    publishDate: '2026-03-01',
  };
  autoFix(item);
  assert.equal(item.examType, '事业单位');
});

test('规则9: 已是医疗卫生的医院招聘保持不变', () => {
  const item = {
    title: '山西省人民医院2026年急需紧缺高层次人才招聘公告',
    examType: '医疗卫生',
    rawHtml: '山西省人民医院……招聘公告。',
    publishDate: '2026-07-01',
  };
  autoFix(item);
  assert.equal(item.examType, '医疗卫生');
});

// ── 规则10: publishDate 落款兜底 ──
test('规则10: publishDate 为采集日时用详情页落款日期', () => {
  const item = {
    title: '四川省人力资源和社会保障厅关于下属事业单位2026年上半年公开招聘工作人员公告',
    publishDate: '2026-08-20', // 采集日兜底
    rawHtml: '……特此公告。\n四川省人力资源和社会保障厅\n2026年3月27日',
  };
  autoFix(item);
  assert.equal(item.publishDate, '2026-03-27');
});

test('规则10: 落款日期带' + '零填充' + '月份', () => {
  const item = {
    title: '新疆维吾尔自治区2026年上半年面向社会公开招聘事业单位工作人员公告',
    publishDate: '2026-08-20',
    rawHtml: '……新疆维吾尔自治区人力资源和社会保障厅 2026年2月28日',
  };
  autoFix(item);
  assert.equal(item.publishDate, '2026-02-28');
});

test('规则10: publishDate 已有正确值不动', () => {
  const item = {
    title: '测试公告',
    publishDate: '2026-06-15',
    rawHtml: '……XX局 2026年3月1日',
  };
  autoFix(item);
  assert.equal(item.publishDate, '2026-06-15');
});

// ── 规则7.5 扩展 ──
test('规则7.5: 技术支持电话工作时间非笔试', () => {
  const item = {
    title: '2026年浙江省省属事业单位公开招聘公告',
    examTime: '9:00-12:00',
    rawHtml: '报考人员如需咨询，请拨打技术支持电话：工作日9:00-12:00，13:00-18:00。笔试时间另行通知。',
    publishDate: '2026-08-01',
  };
  autoFix(item);
  assert.equal(item.examTime, null);
});

test('规则7.5: 监督电话工作时间非笔试', () => {
  const item = {
    title: '2026年XX市事业单位公开招聘公告',
    examTime: '8:00-11:30',
    rawHtml: '监督电话：0531-123456（工作日8:00-11:30，14:00-17:00）。',
    publishDate: '2026-07-01',
  };
  autoFix(item);
  assert.equal(item.examTime, null);
});

test('规则7.5: 资格初审陈述申辩时间非笔试', () => {
  const item = {
    title: '2026年XX省事业单位公开招聘公告',
    examTime: '9:00-12:00',
    rawHtml: '资格初审陈述申辩时间为9:00-12:00，逾期不再受理。',
    publishDate: '2026-07-01',
  };
  autoFix(item);
  assert.equal(item.examTime, null);
});

test('规则7.5: 真实笔试时间保留', () => {
  const item = {
    title: '2026年XX市事业单位公开招聘公告',
    examTime: '9:00-11:30',
    rawHtml: '笔试时间：2026年8月17日（上午9:00-11:30）。',
    publishDate: '2026-08-04',
  };
  autoFix(item);
  assert.equal(item.examTime, '9:00-11:30');
});
