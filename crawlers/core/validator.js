/**
 * 数据验证模块
 * 验证提取后的字段是否符合规范
 */

/**
 * 验证单条公告数据
 * @param {object} announcement - 公告对象
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateData(announcement) {
  const errors = [];

  // 必填字段检查
  if (!announcement.title || announcement.title.trim() === '') {
    errors.push('标题为空');
  }
  if (!announcement.url || !announcement.url.startsWith('http')) {
    errors.push('URL 无效');
  }

  // 数字字段范围检查
  if (announcement.recruitCount !== null && announcement.recruitCount !== undefined) {
    const count = parseInt(announcement.recruitCount);
    if (isNaN(count) || count < 1 || count > 100000) {
      errors.push(`招聘人数异常: ${announcement.recruitCount}`);
    }
  }

  // 日期格式检查 (YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (announcement.examDate && !datePattern.test(announcement.examDate)) {
    errors.push(`考试日期格式错误: ${announcement.examDate}`);
  }
  if (announcement.publishDate && !datePattern.test(announcement.publishDate)) {
    errors.push(`发布日期格式错误: ${announcement.publishDate}`);
  }
  if (announcement.registrationDeadline && !datePattern.test(announcement.registrationDeadline)) {
    errors.push(`报名截止日期格式错误: ${announcement.registrationDeadline}`);
  }

  // 考试科目检查
  if (announcement.examSubjects) {
    if (!Array.isArray(announcement.examSubjects)) {
      errors.push('考试科目应为数组');
    } else if (announcement.examSubjects.length > 20) {
      errors.push(`考试科目过多: ${announcement.examSubjects.length} 个`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
