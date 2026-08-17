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

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  },

  // Cron 定时任务
  async scheduled(event, env, ctx) {
    console.log('Cron triggered at:', new Date().toISOString());
    // TODO: 实现定时爬取逻辑
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

  return jsonResponse({
    data: result.results,
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

  return jsonResponse({ data: result });
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
