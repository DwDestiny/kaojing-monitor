/**
 * 考情监测 API
 * Cloudflare Workers
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS 处理
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // 路由
    try {
      if (url.pathname === '/api/announcements' && request.method === 'GET') {
        return await getAnnouncements(request, env);
      }

      if (url.pathname.match(/^\/api\/announcements\/\d+$/) && request.method === 'GET') {
        const id = url.pathname.split('/').pop();
        return await getAnnouncementById(id, env);
      }

      if (url.pathname === '/api/stats' && request.method === 'GET') {
        return await getStats(env);
      }

      if (url.pathname === '/api/regions' && request.method === 'GET') {
        return await getRegions(env);
      }

      if (url.pathname === '/api/feedback' && request.method === 'POST') {
        return await submitFeedback(request, env);
      }

      if (url.pathname === '/api/ai/classify' && request.method === 'POST') {
        return await classifyContent(request, env);
      }

      if (url.pathname === '/api/ai/extract' && request.method === 'POST') {
        return await extractFields(request, env);
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  },

  // Cron 定时任务
  // 设计：Workers CPU 时间有限，无法直接跑重度爬虫；
  // Cron 只负责触发记录，实际爬取由 GitHub Actions / VPS 等外部执行器完成。
  async scheduled(event, env, ctx) {
    console.log('Cron triggered at:', new Date().toISOString());
    console.log('Cron expression:', event.cron);

    try {
      // 记录 Cron 执行
      await env.DB.prepare(`
        INSERT INTO crawl_logs (website_id, status, items_count, started_at, finished_at, error_message)
        VALUES (0, 'triggered', 0, ?, ?, 'Cron triggered, waiting for external crawler')
      `).bind(
        new Date().toISOString(),
        new Date().toISOString()
      ).run();

      console.log('✅ Cron trigger logged to database');

      // TODO: 触发外部爬虫（GitHub Actions 或 VPS）
      // 方案 1：调用 GitHub Actions workflow_dispatch API
      // 方案 2：调用 VPS webhook
      // 当前阶段：仅记录日志，实际爬取通过手动运行 crawlers/process.js

    } catch (err) {
      console.error('❌ Cron execution failed:', err.message);
    }
  }
};

/**
 * GET /api/announcements
 * 查询公告列表，支持筛选和分页
 */
async function getAnnouncements(request, env) {
  const url = new URL(request.url);
  const params = {
    region: url.searchParams.get('region'),
    examType: url.searchParams.get('examType'),
    examCategory: url.searchParams.get('examCategory'),
    startDate: url.searchParams.get('startDate'),
    endDate: url.searchParams.get('endDate'),
    sortBy: url.searchParams.get('sortBy'),
    sortOrder: url.searchParams.get('sortOrder'),
    page: parseInt(url.searchParams.get('page') || '1'),
    pageSize: parseInt(url.searchParams.get('pageSize') || '20')
  };

  // 构建 SQL
  let sql = 'SELECT * FROM announcements WHERE status = ?';
  const sqlParams = ['active'];

  if (params.region) {
    sql += ' AND region = ?';
    sqlParams.push(params.region);
  }

  if (params.examType) {
    sql += ' AND exam_type = ?';
    sqlParams.push(params.examType);
  }

  // 科目筛选（exam_subjects 为 JSON 数组字符串或逗号/顿号分隔文本）
  if (params.examCategory) {
    sql += ' AND exam_subjects LIKE ?';
    sqlParams.push(`%${params.examCategory}%`);
  }

  if (params.startDate) {
    sql += ' AND publish_date >= ?';
    sqlParams.push(params.startDate);
  }

  if (params.endDate) {
    sql += ' AND publish_date <= ?';
    sqlParams.push(params.endDate);
  }

  // 排序（白名单字段，防止 SQL 注入）
  const sortWhitelist = { publish_date: 'publish_date', id: 'id', title: 'title' };
  const sortBy = sortWhitelist[params.sortBy] || 'publish_date';
  const sortOrder = (params.sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortBy} ${sortOrder}, id DESC`;

  sql += ' LIMIT ? OFFSET ?';
  sqlParams.push(params.pageSize, (params.page - 1) * params.pageSize);

  // 查询
  const result = await env.DB.prepare(sql).bind(...sqlParams).all();

  // 查询总数
  let countSql = 'SELECT COUNT(*) as total FROM announcements WHERE status = ?';
  const countParams = ['active'];
  if (params.region) {
    countSql += ' AND region = ?';
    countParams.push(params.region);
  }
  if (params.examType) {
    countSql += ' AND exam_type = ?';
    countParams.push(params.examType);
  }
  if (params.examCategory) {
    countSql += ' AND exam_subjects LIKE ?';
    countParams.push(`%${params.examCategory}%`);
  }
  if (params.startDate) {
    countSql += ' AND publish_date >= ?';
    countParams.push(params.startDate);
  }
  if (params.endDate) {
    countSql += ' AND publish_date <= ?';
    countParams.push(params.endDate);
  }

  const countResult = await env.DB.prepare(countSql).bind(...countParams).first();

  // 映射 snake_case 到 camelCase
  const mappedData = result.results.map(row => ({
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    region: row.region,
    recruitCount: row.recruit_count,
    examDate: row.exam_date,
    examTime: row.exam_time,
    examSubjects: row.exam_subjects,
    examType: row.exam_type,
    examCategory: row.exam_category,
    examLocation: row.exam_location,
    registrationDeadline: row.registration_deadline,
    salaryRange: row.salary_range,
    publishDate: row.publish_date,
    crawledAt: row.crawled_at
  }));

  return jsonResponse({
    data: mappedData,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / params.pageSize)
    }
  });
}

/**
 * GET /api/announcements/:id
 * 获取公告详情
 */
async function getAnnouncementById(id, env) {
  const result = await env.DB.prepare(
    'SELECT * FROM announcements WHERE id = ?'
  ).bind(id).first();

  if (!result) {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  // 映射 snake_case 到 camelCase
  const mappedData = {
    id: result.id,
    title: result.title,
    url: result.url,
    source: result.source,
    region: result.region,
    recruitCount: result.recruit_count,
    examDate: result.exam_date,
    examTime: result.exam_time,
    examSubjects: result.exam_subjects,
    examType: result.exam_type,
    examCategory: result.exam_category,
    examLocation: result.exam_location,
    registrationDeadline: result.registration_deadline,
    salaryRange: result.salary_range,
    publishDate: result.publish_date,
    crawledAt: result.crawled_at,
    rawHtml: result.raw_html
  };

  return jsonResponse({ data: mappedData });
}

/**
 * GET /api/stats
 * 获取统计数据
 */
async function getStats(env) {
  // 总数
  const total = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM announcements WHERE status = ?'
  ).bind('active').first();

  // 按地区统计
  const byRegion = await env.DB.prepare(
    'SELECT region, COUNT(*) as count FROM announcements WHERE status = ? GROUP BY region ORDER BY count DESC'
  ).bind('active').all();

  // 按考试类型统计
  const byExamType = await env.DB.prepare(
    'SELECT exam_type, COUNT(*) as count FROM announcements WHERE status = ? GROUP BY exam_type ORDER BY count DESC'
  ).bind('active').all();

  // 最近更新时间
  const lastUpdate = await env.DB.prepare(
    'SELECT MAX(crawled_at) as last_crawl FROM announcements'
  ).first();

  return jsonResponse({
    total: total.count,
    byRegion: byRegion.results,
    byExamType: byExamType.results,
    lastUpdate: lastUpdate.last_crawl
  });
}

/**
 * GET /api/regions
 * 获取地区列表
 */
async function getRegions(env) {
  const result = await env.DB.prepare(
    'SELECT DISTINCT region FROM announcements WHERE status = ? ORDER BY region'
  ).bind('active').all();

  return jsonResponse({
    data: result.results.map(r => r.region)
  });
}

/**
 * POST /api/feedback
 * 提交用户反馈
 */
async function submitFeedback(request, env) {
  const body = await request.json();
  const { type, content, email } = body;

  if (!type || !content) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  // 插入反馈表
  await env.DB.prepare(
    'INSERT INTO user_feedback (type, content, email, created_at) VALUES (?, ?, ?, ?)'
  ).bind(type, content, email || null, new Date().toISOString()).run();

  return jsonResponse({ success: true });
}

/**
 * CORS 响应
 */
function handleCORS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * JSON 响应辅助函数
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * 按 UTF-8 字节数截断字符串（在字符边界切断，保证结果 ≤ maxBytes）
 */
function truncateToBytes(str, maxBytes) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  if (bytes.length <= maxBytes) return str;
  let end = maxBytes;
  // UTF-8 续字节为 10xxxxxx，回退到完整字符起点
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  return new TextDecoder().decode(bytes.slice(0, end));
}

/**
 * 从 Workers AI 响应中提取可解析的文本
 * 兼容：string / {response} / {result} / {result.response}
 * 若字段值已是对象（JSON mode），则序列化为字符串
 */
function extractAiText(response) {
  if (response == null) return '';
  if (typeof response === 'string') return response;

  let value;
  if (Object.prototype.hasOwnProperty.call(response, 'response')) {
    value = response.response;
  } else if (Object.prototype.hasOwnProperty.call(response, 'result')) {
    value = response.result;
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'response')) {
      value = value.response;
    }
  } else {
    value = response;
  }

  if (typeof value === 'string') return value;
  if (value != null && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

/**
 * 从 AI 文本中解析 JSON 对象
 */
function parseAiJson(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]);
}

/**
 * POST /api/ai/classify
 * 判断标题+摘要是否为招考公告
 */
async function classifyContent(request, env) {
  try {
    const body = await request.json();
    const { title, snippet } = body;

    if (!title || !snippet) {
      return jsonResponse({ error: 'Missing required fields: title, snippet' }, 400);
    }

    const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        {
          role: 'system',
          content: '你是招考公告分类专家。请严格按 JSON 格式返回结果，不要输出其他内容。'
        },
        {
          role: 'user',
          content: `判断以下内容是否为【正式招考公告】。

【核心判断标准】
必须同时满足三个条件才是招考公告：
1. 内容本质：是一篇完整的公告文档，包含岗位信息、招聘条件、报名方式等实质内容
2. 目的性：目的是向社会公布招聘信息，而不是通知已报名考生做某件事
3. 时间节点：处于招聘流程的起点（发布招聘），而非中间环节或结果公示

【正例（是招考公告）】
✅ 招聘公告：详细说明招聘岗位、人数、条件、流程
✅ 招考简章：完整的招考文件
✅ 选调/遴选公告：完整的选调文件

【负例（不是招考公告）】
❌ 报名入口/操作指南：只是一个链接或操作说明，不是公告本身
❌ 流程通知（心理测评、体检、资格审查）：针对已报名考生的后续环节通知
❌ 结果公示（成绩、面试名单、拟聘用）：招聘流程的结果，不是起点公告
❌ 活动通知（招聘会、宣讲会）：活动信息，不是正式招聘

【输入】
标题：${title}
摘要：${snippet}

【判断要点】
- 如果标题只是"报名入口"、"操作指南"，即使包含"招聘"关键词，也不是公告
- 如果是针对已通过某环节考生的通知（心理测评、面试、体检），不是公告
- 如果是结果类（成绩、名单、公示），不是公告
- 必须是完整的、原始的招聘信息发布文档

请返回 JSON：{"isRecruitment": boolean, "confidence": number, "reason": string}
confidence 为 0-1，reason 说明判断依据（一句话）。`
        }
      ],
      max_tokens: 512
    });

    const text = extractAiText(response);
    let result;
    try {
      result = parseAiJson(text);
    } catch (parseError) {
      console.error('classifyContent parse error:', {
        typeofResponse: typeof response,
        rawResponse: response,
        extractedText: text,
        parseError: parseError.message
      });
      return jsonResponse({ error: 'Failed to parse AI response', raw: text }, 500);
    }
    if (!result) {
      console.error('classifyContent no JSON found:', {
        typeofResponse: typeof response,
        rawResponse: response,
        extractedText: text
      });
      return jsonResponse({ error: 'Failed to parse AI response', raw: text }, 500);
    }

    return jsonResponse(result);
  } catch (error) {
    console.error('classifyContent error:', error);
    return jsonResponse({ error: error.message || 'AI classification failed' }, 500);
  }
}

/**
 * POST /api/ai/extract
 * 从 HTML 中提取招聘人数和考试科目
 */
async function extractFields(request, env) {
  try {
    const body = await request.json();
    const { title, rawHtml } = body;

    if (!title || !rawHtml) {
      return jsonResponse({ error: 'Missing required fields: title, rawHtml' }, 400);
    }

    // 截断到前 32KB（32768 字节），避免超出模型上下文限制
    const htmlStr = typeof rawHtml === 'string' ? rawHtml : String(rawHtml);
    const truncatedHtml = truncateToBytes(htmlStr, 32768);

    const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        {
          role: 'system',
          content: '你是招考信息提取专家。请严格按 JSON 格式返回结果，不要输出其他内容。'
        },
        {
          role: 'user',
          content: `从以下招考公告 HTML 中提取招聘人数和考试科目。

招聘人数规则：
- 忽略规则说明中的数字（如"每人限报1个职位"、"5年以上工作经验"）
- 提取实际招聘总数或各职位人数总和
- 无法确定时返回 null

考试科目规则：
- 保留原始科目名称（如"综合应用能力A类"、"职业能力倾向测验"）
- 不要简化或改写
- 找不到时返回空数组

标题：${title}
HTML：
${truncatedHtml}

请返回 JSON：{"recruitCount": number|null, "examSubjects": string[], "confidence": number}
其中 confidence 为 0-1 之间的置信度。`
        }
      ],
      max_tokens: 512
    });

    const text = extractAiText(response);
    let result;
    try {
      result = parseAiJson(text);
    } catch (parseError) {
      console.error('extractFields parse error:', {
        typeofResponse: typeof response,
        rawResponse: response,
        extractedText: text,
        parseError: parseError.message
      });
      return jsonResponse({ error: 'Failed to parse AI response', raw: text }, 500);
    }
    if (!result) {
      console.error('extractFields no JSON found:', {
        typeofResponse: typeof response,
        rawResponse: response,
        extractedText: text
      });
      return jsonResponse({ error: 'Failed to parse AI response', raw: text }, 500);
    }

    return jsonResponse(result);
  } catch (error) {
    console.error('extractFields error:', error);
    return jsonResponse({ error: error.message || 'AI extraction failed' }, 500);
  }
}
