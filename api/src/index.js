/**
 * 考情监测 API
 * Cloudflare Workers
 */

// ── 顶部常量（模型名 / 白名单 / Schema 集中管理） ──

// 提取模型：用户指定 qwen3.8-27b（27B，中文强）
// 注意：成本约 40909/290909 neurons-per-M（qwen3-30b-a3b-fp8 的约 9 倍），
// 139 条全量重提 ≈ 53,600 neurons 超出免费额度（10,000/天），每日 50 条新增 ≈ 19,300 也超 → 约 $3/月
// 若超预算，可改用 qwen3-30b-a3b-fp8（免费额度内）——见 env.EXTRACT_MODEL 覆盖。
// JSON Mode 兼容性需实测，报错时自动回退 llama-3.1-8b-instruct-fp8-fast。
// 模型名优先读 env.EXTRACT_MODEL（wrangler.toml vars 或 dashboard secret），未配置则用此默认值。
const EXTRACT_MODEL = '@cf/qwen/qwen3.8-27b';
const EXTRACT_MODEL_FALLBACK = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';

// 反馈类型枚举（安全校验白名单）
const FEEDBACK_TYPES = ['new_website', 'bug_report', 'data_error', 'feature_request', 'other'];

// /api/ai/extract 的 JSON Schema：强制模型按此结构输出，覆盖全部提取字段 + confidence + missingFields + warnings
const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    recruitCount: { type: ['integer', 'null'], description: '招聘总人数，无法确定时为 null' },
    examDate: { type: ['string', 'null'], description: '笔试日期，格式 YYYY-MM-DD' },
    examTime: { type: ['string', 'null'], description: '考试时间，如 HH:MM-HH:MM' },
    examSubjects: { type: 'array', items: { type: 'string' }, description: '考试科目列表，找不到返回空数组，保留原始科目名称' },
    examType: { type: ['string', 'null'], description: '考试类型：事业单位/公务员/教师招聘/三支一扶/医疗卫生/国企招聘/其他' },
    examLocation: { type: ['string', 'null'], description: '考试地点' },
    registrationDeadline: { type: ['string', 'null'], description: '报名截止日期，格式 YYYY-MM-DD' },
    salaryRange: { type: ['string', 'null'], description: '薪资范围' },
    confidence: { type: 'number', minimum: 0, maximum: 1, description: '整体提取置信度 0-1' },
    missingFields: { type: 'array', items: { type: 'string' }, description: '无法从原文中提取到的字段名列表' },
    warnings: { type: 'array', items: { type: 'string' }, description: '提取过程中的风险警告' }
  },
  required: ['recruitCount', 'examDate', 'examSubjects', 'confidence']
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    let response;

    // CORS 预检请求（Allow-Origin 头由下方统一按白名单回显）
    if (request.method === 'OPTIONS') {
      response = handleCORS();
    } else {
      // 路由
      try {
        if (url.pathname === '/api/announcements' && request.method === 'GET') {
          response = await getAnnouncements(request, env);
        } else if (url.pathname.match(/^\/api\/announcements\/\d+$/) && request.method === 'GET') {
          const id = url.pathname.split('/').pop();
          response = await getAnnouncementById(id, env);
        } else if (url.pathname === '/api/stats' && request.method === 'GET') {
          response = await getStats(env);
        } else if (url.pathname === '/api/regions' && request.method === 'GET') {
          response = await getRegions(env);
        } else if (url.pathname === '/api/feedback' && request.method === 'POST') {
          response = await submitFeedback(request, env);
        } else if (url.pathname === '/api/ai/classify' && request.method === 'POST') {
          response = await classifyContent(request, env);
        } else if (url.pathname === '/api/ai/extract' && request.method === 'POST') {
          response = await extractFields(request, env);
        } else if (url.pathname === '/api/import' && request.method === 'POST') {
          // 数据导入端点：GitHub Actions 定时爬虫完成后自动调此端点写库（D1 binding 直连，无需 wrangler 凭证）
          response = await importAnnouncements(request, env);
        } else {
          response = jsonResponse({ error: 'Not found' }, 404);
        }
      } catch (error) {
        console.error('API Error:', error);
        // 安全加固：不返回内部错误细节（DB 错误原文、堆栈等），统一 500
        response = jsonResponse({ error: 'Internal server error' }, 500);
      }
    }

    // 安全加固：CORS 仅对白名单 Origin 回显；非白名单或同源请求不返回 CORS 头
    const allowedOrigin = getAllowedOrigin(request, env);
    if (allowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    }

    return response;
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
    page: Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1),
    // 安全加固：pageSize 上限 100，防止传 100000 之类的大值拖垮 D1
    pageSize: Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20))
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
  // 安全加固：LIKE 通配符 % _ \ 需转义（escapeLike），并配合 SQL 的 ESCAPE '\'
  if (params.examCategory) {
    sql += " AND exam_subjects LIKE ? ESCAPE '\\'";
    sqlParams.push(`%${escapeLike(params.examCategory)}%`);
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
    countSql += " AND exam_subjects LIKE ? ESCAPE '\\'";
    countParams.push(`%${escapeLike(params.examCategory)}%`);
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
    examNote: row.exam_note,
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

  // 安全加固：类型枚举 + 内容长度上限校验
  if (!FEEDBACK_TYPES.includes(type)) {
    return jsonResponse({ error: 'Invalid feedback type' }, 400);
  }
  if (typeof content !== 'string' || content.length > 2000) {
    return jsonResponse({ error: 'Content must be a string no longer than 2000 characters' }, 400);
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
  // Access-Control-Allow-Origin 由 fetch 入口统一按白名单回显，这里只声明方法与请求头
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * JSON 响应辅助函数
 */
function jsonResponse(data, status = 200) {
  // Access-Control-Allow-Origin 由 fetch 入口统一按白名单回显，不在此处写死
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * CORS 白名单：读取 env.ALLOWED_ORIGINS（逗号分隔），默认仅允许官方部署域名。
 * 请求 Origin 在列表内则回显该 origin，否则返回 null（即不返回 CORS 头，浏览器将拦截跨域读取）。
 */
function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS || 'https://kaojing-monitor.pages.dev')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

/**
 * LIKE 通配符转义：转义 % _ \，配合 SQL 的 ESCAPE '\' 使用，防止通配符注入
 */
function escapeLike(term) {
  return String(term).replace(/[%_\\]/g, m => '\\' + m);
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
 * 兼容：OpenAI 兼容格式 {choices:[{message:{content}}]}（qwen3.8-27b 等新模型）
 * 兼容：{choices:[{message:{content}}]} 的 message.content 是对象的情况（JSON mode）
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
  } else if (
    Array.isArray(response.choices) &&
    response.choices.length > 0 &&
    response.choices[0].message
  ) {
    // OpenAI 兼容格式：qwen3.8-27b 等新模型返回 {choices:[{message:{content:"..."}}]}
    value = response.choices[0].message.content;
    // 若 content 本身是对象（JSON mode），序列化为字符串
    if (value != null && typeof value === 'object') {
      value = JSON.stringify(value);
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
    // 鉴权：AI 端点必须携带 Bearer token（env.AI_API_TOKEN，来自 wrangler.toml vars 或 dashboard secret，不硬编码）
    const auth = request.headers.get('Authorization') || '';
    if (auth !== `Bearer ${env.AI_API_TOKEN}`) return jsonResponse({ error: 'Unauthorized' }, 401);

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
 * 从 HTML 中提取招聘人数、考试科目、日期/类型/地点等结构化字段
 */
async function extractFields(request, env) {
  try {
    // 鉴权：AI 端点必须携带 Bearer token（env.AI_API_TOKEN，来自 wrangler.toml vars 或 dashboard secret，不硬编码）
    const auth = request.headers.get('Authorization') || '';
    if (auth !== `Bearer ${env.AI_API_TOKEN}`) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await request.json();
    const { title, rawHtml } = body;

    if (!title || !rawHtml) {
      return jsonResponse({ error: 'Missing required fields: title, rawHtml' }, 400);
    }

    // 截断输入正文：公告核心信息（人数/时间/科目）通常在前 8KB；
    // 实测 25KB 输入会导致 qwen3.8-27b 推理超时（111s → HTTP 500），8KB 输入 34s 成功。
    const htmlStr = typeof rawHtml === 'string' ? rawHtml : String(rawHtml);
    const truncatedHtml = truncateToBytes(htmlStr, 8192);

    // 系统提示词强化：按 schema 提取，无把握返回 null，禁止编造（消灭幻觉模板科目）
    const messages = [
      {
        role: 'system',
        content: '你是招考公告信息提取专家。按 schema 提取，无把握的字段返回 null，禁止编造。'
      },
      {
        role: 'user',
        content: `从以下招考公告中提取结构化信息，严格按 JSON Schema 定义输出。

招聘人数规则：
- 忽略规则说明中的数字（如"每人限报1个职位"、"5年以上工作经验"）
- 提取实际招聘总数或各职位人数总和
- 无法确定时返回 null

考试科目规则：
- 保留原始科目名称（如"综合应用能力A类"、"职业能力倾向测验"）
- 不要简化或改写
- 找不到时返回空数组

标题：${title}
正文HTML：
${truncatedHtml}`
      }
    ];

    // JSON Mode：response_format 强制模型输出符合 EXTRACT_SCHEMA 的结构，杜绝幻觉模板科目
    // max_tokens: qwen3.8-27b 是推理模型，思维链(reasoning)会占用大量 token；
    // 之前 1024 导致 finish_reason=length 截断（content 只生成 "{\"co" 就断了）→ 提到 4096
    const runOptions = {
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: EXTRACT_SCHEMA
      },
      max_tokens: 4096
    };

    // 模型优先读 env.EXTRACT_MODEL，默认 qwen3-30b
    // 注：qwen3-30b-a3b-fp8 不在官方 JSON Mode 支持列表，需实测；
    // 若 response_format 调用报错，自动回退到官方确认支持 JSON Mode 的 llama-3.1-8b-instruct-fp8-fast
    let model = env.EXTRACT_MODEL || EXTRACT_MODEL;
    let response;
    try {
      response = await env.AI.run(model, runOptions);
    } catch (aiError) {
      if (model !== EXTRACT_MODEL_FALLBACK) {
        console.warn(`extractFields 模型 ${model} 调用失败(${aiError.message})，回退到 ${EXTRACT_MODEL_FALLBACK}`);
        response = await env.AI.run(EXTRACT_MODEL_FALLBACK, runOptions);
      } else {
        throw aiError;
      }
    }

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


/**
 * POST /api/import
 * 数据导入端点（自动写库，D1 binding 直连）
 * 由 GitHub Actions 定时爬虫 / 本地脚本调用：爬取→提取→规则清洗后，把 items POST 到此端点，
 * Worker 内部通过 D1 binding 直接写入 announcements 表，INSERT OR IGNORE + url_hash 去重。
 * 无需 wrangler 凭证（凭证由 Worker 部署时注入，见 wrangler.toml [[d1_databases]]）。
 * 鉴权：与 AI 端点相同，必须携带 Bearer token（env.AI_API_TOKEN）。
 * body: { items: [{ title, url, urlHash, contentHash, source, region, recruitCount,
 *                   examDate, examTime, examSubjects[], examType, examLocation,
 *                   registrationDeadline, salaryRange, publishDate, crawledAt, rawHtml,
 *                   complianceLevel? }] }
 */
async function importAnnouncements(request, env) {
  // 鉴权（与 /api/ai/extract 一致）
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.AI_API_TOKEN}`) return jsonResponse({ error: 'Unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return jsonResponse({ error: 'Missing required field: items (non-empty array)' }, 400);
  }
  if (items.length > 500) {
    return jsonResponse({ error: 'items too large, max 500 per request' }, 400);
  }

  // 字段映射：camelCase → snake_case（与 database/schema-d1.sql 列一致）
  const statements = [];
  let valid = 0;
  const skipped = [];

  for (const item of items) {
    if (!item.title || !item.url) {
      skipped.push({ reason: 'missing title/url', title: item.title || '(空)' });
      continue;
    }
    valid++;

    // raw_html：受限源（compliance_level=restricted）只存 2000 字符 snippet，普通源截断 100KB
    const rawHtml = (item.rawHtml || '').slice(0, item.complianceLevel === 'restricted' ? 2000 : 100000);
    const crawledAt = item.crawledAt || item.crawled_at || new Date().toISOString();
    const subjects = Array.isArray(item.examSubjects)
      ? item.examSubjects.join(',')
      : (typeof item.examSubjects === 'string' ? item.examSubjects : null);

    const stmt = env.DB.prepare(`
      INSERT OR IGNORE INTO announcements
        (title, url, url_hash, content_hash, source_website_id, source, region,
         recruit_count, exam_date, exam_time, exam_subjects, exam_type, exam_category,
         exam_location, registration_deadline, salary_range, publish_date, exam_note,
         crawled_at, extracted_at, status, raw_html)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).bind(
      item.title,
      item.url,
      item.urlHash || item.url,
      item.contentHash || null,
      item.source || 'unknown',
      item.region || '未知',
      item.recruitCount || null,
      item.examDate || null,
      item.examTime || null,
      subjects,
      item.examType || null,
      item.examLocation || null,
      item.registrationDeadline || null,
      item.salaryRange || null,
      item.publishDate || null,
      item.examNote || null,
      crawledAt,
      new Date().toISOString(),
      rawHtml
    );
    statements.push(stmt);
  }

  if (statements.length === 0) {
    return jsonResponse({ imported: 0, skipped, total: 0 }, 200);
  }

  // 分批执行（D1 batch 单批上限 100 条，此处按 50 分批，避免超限）
  let imported = 0;
  for (let i = 0; i < statements.length; i += 50) {
    const batch = statements.slice(i, i + 50);
    const results = await env.DB.batch(batch);
    for (const r of results) {
      // meta.changes > 0 表示真正插入（INSERT OR IGNORE 命中重复时 changes=0）
      imported += (r.meta && r.meta.changes) || 0;
    }
  }

  return jsonResponse({
    imported,
    skipped,
    total: valid,
    message: `导入完成：新增 ${imported} 条，重复跳过 ${valid - imported} 条`
  });
}
