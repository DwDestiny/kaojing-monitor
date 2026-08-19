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
 * 策略：提取所有匹配的数字，过滤异常值，返回最大值
 * 匹配模式：
 * - "招聘XX人" / "招聘人员XX人"
 * - "招考XX名"
 * - "计划招录XX人"
 * - "拟招聘XX名"
 */
function extractRecruitCount(text) {
  const patterns = [
    // 允许关键词和数字之间有0-10个非数字字符（如"招聘人员18人"）
    /(?:招聘|招考|招录|拟招|计划招)[^0-9]{0,10}?(\d+)[\s]*(?:人|名)/g,
    /共计?[\s]*(\d+)[\s]*(?:个)?(?:岗位|职位)[\s]*(\d+)[\s]*(?:人|名)/g,
    /总计[\s]*(\d+)[\s]*(?:人|名)/g
  ];

  const allNumbers = [];

  for (const pattern of patterns) {
    let match;
    // 使用 while 循环提取所有匹配
    while ((match = pattern.exec(text)) !== null) {
      // 如果匹配到两个数字（如"共10个岗位50人"），取第二个（人数）
      const count = match[2] ? parseInt(match[2]) : parseInt(match[1]);
      allNumbers.push(count);
    }
  }

  // 过滤掉异常值：<5 或 >50000
  const validNumbers = allNumbers.filter(n => n >= 5 && n <= 50000);

  // 返回最大值，如果没有有效数字返回 null
  return validNumbers.length > 0 ? Math.max(...validNumbers) : null;
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
    /(?:笔试|考试)(?:时间|日期)?[：:为是。]?\s*(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]?/,
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
    /(\d{1,2}):(\d{2})\s*[-~至到—]\s*(\d{1,2}):(\d{2})/,
    /(?:上午|下午)\s*(\d{1,2}):(\d{2})\s*[-~至到—]\s*(?:上午|下午)?\s*(\d{1,2}):(\d{2})/
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
 * 直接从文本中提取原始科目名称，不做标准化归类
 * 匹配模式：
 * - "考试科目：教育学、教育心理学、综合知识"
 * - "笔试科目为行测及申论"
 */
function extractExamSubjects(text) {
  const pattern = /(?:考试科目|笔试科目|考查科目)[：:为是]?\s*([^\n。；;]+)/;
  const match = text.match(pattern);

  if (!match) return [];

  const subjectsText = match[1];

  // 按顿号和「及」分割
  const subjects = subjectsText
    .split(/[、及和]/)
    .map(s => s.replace(/[《》\"\"\'\']/g, '').replace(/[两三四五]科$/, '').trim())
    .filter(s => s.length > 0 && !/^.{1,6}类$/.test(s));

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
 * 优先匹配"报名时间：X年X月X日 至 X月X日"的第二个日期（截止日）
 */
function extractRegistrationDeadline(text) {
  const patterns = [
    // 0. 报名时间段：X年X月X日...至...X月X日（取"至"后的日期，即截止日）
    /报名[^。]{0,80}?至\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/,
    // 1. 报名时间段：报名时间X月X日-X月X日（取第二个日期）
    /报名[^。]{0,50}?(\d{1,2})[月\-/](\d{1,2})[日号]?\s*[-~—至]\s*(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]/,
    // 2. 明确截止表述
    /(?:报名截止|报名结束)[时间日期为至]?\s*[：:]?\s*(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]/,
    // 3. X年X月X日前（截止报名）
    /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]?\s*(?:前|之前|截止)(?:报名)?/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    // 模式 0/1 返回"至"后的日期（match[1-3] 或 match[3-5]）
    if (pattern === patterns[0]) {
      const year = match[1] || new Date().getFullYear();
      return `${year}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
    if (pattern === patterns[1]) {
      const year = match[3] || new Date().getFullYear();
      return `${year}-${String(match[4]).padStart(2, '0')}-${String(match[5]).padStart(2, '0')}`;
    }
    // 模式 2/3 返回 match[1-3]
    const [, year, month, day] = match;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
