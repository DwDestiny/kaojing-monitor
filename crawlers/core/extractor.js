/**
 * 数据提取模块
 * 从公告正文中智能提取结构化字段
 */

/**
 * 从公告标题和内容中提取结构化字段
 * @param {object} announcement - 公告对象 {title, rawHtml, url}
 * @returns {object} 提取的字段
 */
export function extractFields(announcement) {
  const { title, rawHtml } = announcement;
  const text = `${title} ${cleanHtml(rawHtml)}`;

  return {
    recruitCount: extractRecruitCount(text),
    examDate: extractExamDate(text),
    examTime: extractExamTime(text),
    examSubjects: extractExamSubjects(text),
    examType: classifyExamType(title, text),
    registrationDeadline: extractRegistrationDeadline(text),
    examLocation: extractExamLocation(text),
    salaryRange: extractSalaryRange(text)
  };
}

/**
 * 清理 HTML 标签，保留纯文本
 */
function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 提取招考人数
 * 匹配模式：
 * - "招聘XX人"
 * - "招考XX名"
 * - "计划招录XX人"
 * - "拟招聘XX名"
 */
function extractRecruitCount(text) {
  const patterns = [
    /(?:招聘|招考|招录|拟招|计划招)[\s]*(\d+)[\s]*(?:人|名)/,
    /共[\s]*(\d+)[\s]*(?:个)?(?:岗位|职位)[\s]*(\d+)[\s]*(?:人|名)/,  // "共10个岗位50人"
    /总计[\s]*(\d+)[\s]*(?:人|名)/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // 如果匹配到两个数字，取第二个（人数）
      const count = match[2] ? parseInt(match[2]) : parseInt(match[1]);
      if (count > 0 && count < 100000) {  // 合理性检查
        return count;
      }
    }
  }

  return null;
}

/**
 * 提取笔试日期
 * 匹配模式：
 * - "2026年8月17日"
 * - "2026-08-17"
 * - "8月17日"（补充当前年份）
 */
function extractExamDate(text) {
  const patterns = [
    /(?:笔试|考试)(?:时间|日期)?[：:为是]?\s*(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]?/,
    /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]?\s*(?:举行|进行)?(?:笔试|考试)/,
    /(\d{1,2})[月\-/](\d{1,2})[日号]?\s*(?:举行|进行)?(?:笔试|考试)/  // 无年份，使用当前年
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let year, month, day;

      if (match.length === 4) {
        // 包含年份
        [, year, month, day] = match;
      } else {
        // 无年份，使用当前年
        const currentYear = new Date().getFullYear();
        [, month, day] = match;
        year = currentYear;
      }

      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * 提取笔试时间
 * 匹配模式：
 * - "9:00-11:00"
 * - "上午9:00至11:00"
 */
function extractExamTime(text) {
  const patterns = [
    /(\d{1,2}):(\d{2})\s*[-~至到]\s*(\d{1,2}):(\d{2})/,
    /(?:上午|下午)\s*(\d{1,2}):(\d{2})\s*[-~至到]\s*(?:上午|下午)?\s*(\d{1,2}):(\d{2})/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const [, h1, m1, h2, m2] = match;
      return `${h1}:${m1}-${h2}:${m2}`;
    }
  }

  return null;
}

/**
 * 提取考试科目
 */
function extractExamSubjects(text) {
  const subjects = [];
  const subjectKeywords = {
    '行测': ['行政职业能力测验', '行政能力测试', '行测'],
    '申论': ['申论'],
    '公共基础知识': ['公共基础知识', '公基', '综合基础知识'],
    '综合应用能力': ['综合应用能力'],
    '专业知识': ['专业知识', '专业科目'],
    '教育综合': ['教育综合知识', '教育学', '教育心理学'],
    '医学基础': ['医学基础知识', '医学综合'],
    '面试': ['面试', '结构化面试']
  };

  for (const [subject, keywords] of Object.entries(subjectKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword) && !subjects.includes(subject)) {
        subjects.push(subject);
        break;
      }
    }
  }

  return subjects;
}

/**
 * 分类考试类型
 */
function classifyExamType(title, text) {
  const typeKeywords = {
    '事业单位': ['事业单位', '事业编'],
    '公务员': ['公务员', '国考', '省考'],
    '三支一扶': ['三支一扶', '支教', '支农', '支医'],
    '教师招聘': ['教师招聘', '教师公开招聘', '教师编制'],
    '特岗教师': ['特岗教师', '特岗计划'],
    '医疗卫生': ['医疗卫生', '医院招聘', '卫生系统'],
    '国企招聘': ['国企', '央企', '集团招聘'],
    '选调生': ['选调生'],
    '大学生村官': ['大学生村官', '村官']
  };

  // 优先匹配标题
  for (const [type, keywords] of Object.entries(typeKeywords)) {
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        return type;
      }
    }
  }

  // 其次匹配正文
  for (const [type, keywords] of Object.entries(typeKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return type;
      }
    }
  }

  return '其他';
}

/**
 * 提取报名截止时间
 */
function extractRegistrationDeadline(text) {
  const patterns = [
    /(?:报名截止|报名结束)[时间日期为至]?\s*[：:]?\s*(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]/,
    /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]?\s*(?:前|之前|截止)(?:报名)?/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * 提取考试地点
 */
function extractExamLocation(text) {
  const patterns = [
    /(?:考试地点|笔试地点)[：:为]\s*([^\n。，,；;]{2,30})/,
    /在\s*([^\n。，,]{2,20})\s*(?:举行|进行)(?:笔试|考试)/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * 提取薪资范围
 */
function extractSalaryRange(text) {
  const patterns = [
    /(?:年薪|薪资|工资)[：:]\s*([\d万千百十\-~至]+)/,
    /([\d]+)[万千]?[-~至]([\d]+)[万千]?元/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] || `${match[1]}-${match[2]}`;
    }
  }

  return null;
}

/**
 * 批量提取（用于已爬取的数据）
 * @param {Array} announcements - 公告数组
 * @returns {Array} 提取后的公告数组
 */
export function batchExtract(announcements) {
  return announcements.map(announcement => {
    const extracted = extractFields(announcement);
    return {
      ...announcement,
      ...extracted
    };
  });
}
