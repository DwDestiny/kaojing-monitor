/**
 * AI 内容过滤器
 * 使用 Cloudflare Workers AI 判断是否为招考公告
 *
 * 注意：此模块在 Workers 环境中使用，本地开发时 env.AI 不可用
 */

export async function filterAnnouncements(announcements, env) {
  if (!env?.AI) {
    console.warn('⚠️  AI 环境不可用，使用规则过滤');
    return ruleBasedFilter(announcements);
  }

  console.log(`\n🤖 AI 过滤: ${announcements.length} 条数据`);

  const results = [];
  const filtered = [];

  for (const item of announcements) {
    try {
      const isValid = await isRecruitmentAnnouncement(item.title, env);

      if (isValid) {
        results.push(item);
      } else {
        filtered.push(item.title);
        console.log(`  ❌ 过滤: ${item.title}`);
      }

    } catch (err) {
      console.error(`  ⚠️  AI 判断失败: ${err.message}`);
      // 失败时保守策略：保留数据
      results.push(item);
    }
  }

  console.log(`✅ 过滤完成: 保留 ${results.length} 条，过滤 ${filtered.length} 条\n`);
  return results;
}

/**
 * 规则过滤（AI 不可用时的降级方案）
 */
function ruleBasedFilter(announcements) {
  // 优先级 1: 活动通知类黑名单（必须在白名单检查前执行）
  const activityBlacklist = [
    '招聘会', '联合招聘', '人才交流会', '双选会', '宣讲会',
    '推介会', '洽谈会', '对接会', '座谈会', '见面会',
    '关于举办', '活动通知', '活动公告',
  ];

  // 优先级 2: 结果公示类黑名单
  const blacklist = [
    '证书发放', '档案', '公示名单', '拟聘用', '体检通知', '资格审查结果',
    '分数线', '成绩公告', '成绩查询', '面试名单', '拟聘', '拟任', '拟任职',
    '就业促进', '绩效', '职称', '职业资格', '答题卡', '人选公示',
    '特聘人员公示', '博士后', '资助对象', '表彰推', '专业技术人才', '技能大奖',
    // 优先级 3: 流程环节类（报名入口、准考证、心理测评等）
    '报名入口', '考试报名入口', '注册指南', '操作手册', '操作指南', '账号注册',
    '缴费入口', '准考证打印', '准考证下载',
    '心理测评', '心理测评链接', '心理测评通知',
    '资格复审',
  ];
  const whitelist = ['招聘', '招考', '招录', '公开招', '公开招聘', '公开考试', '遴选', '选调'];
  const negativeKeywords = ['陷阱', '诈骗', '虚假', '风险', '提醒', '案例', '警示', '典型案例', '违法', '犯罪'];

  return announcements.filter(item => {
    const title = item.title;

    // 活动通知类优先过滤
    for (const keyword of activityBlacklist) {
      if (title.includes(keyword)) {
        console.log(`  ❌ 规则过滤(活动通知): ${title}`);
        return false;
      }
    }

    // 结果公示类黑名单
    for (const keyword of blacklist) {
      if (title.includes(keyword)) {
        console.log(`  ❌ 规则过滤: ${title}`);
        return false;
      }
    }

    // 白名单检查（先标记，不立即放行）
    let hasWhitelistKeyword = false;
    for (const keyword of whitelist) {
      if (title.includes(keyword)) {
        hasWhitelistKeyword = true;
        break;
      }
    }

    // 白名单命中但含负面词 → 拒绝（如「虚假招聘诈骗」「招聘陷阱风险提醒」）
    if (hasWhitelistKeyword) {
      for (const keyword of negativeKeywords) {
        if (title.includes(keyword)) {
          console.log(`  ❌ 规则过滤(负面词): ${title}`);
          return false;
        }
      }
    }

    // 结果类标题拦截（如「遴选推荐结果的公示」）
    if (/(结果|推荐结果).*公示/.test(title) || /公示.*(结果|推荐结果)/.test(title)) {
      console.log(`  ❌ 规则过滤(结果公示): ${title}`);
      return false;
    }

    // 白名单命中且无负面词/结果模式 → 放行
    if (hasWhitelistKeyword) {
      return true;
    }

    // 无黑白名单关键词 → 拒绝（招考公告必然含白名单词）
    console.log(`  ❌ 规则过滤(无白名单): ${title}`);
    return false;
  });
}

/**
 * 判断标题是否为招考公告
 */
async function isRecruitmentAnnouncement(title, env) {
  // 优先级 1: 活动通知类黑名单（必须在白名单检查前执行）
  const activityBlacklist = [
    '招聘会', '联合招聘', '人才交流会', '双选会', '宣讲会',
    '推介会', '洽谈会', '对接会', '座谈会', '见面会',
    '关于举办', '活动通知', '活动公告',
  ];
  for (const keyword of activityBlacklist) {
    if (title.includes(keyword)) {
      return false;
    }
  }

  // 优先级 2: 结果公示类黑名单
  const blacklist = [
    '证书发放', '档案', '公示名单', '拟聘用', '体检通知', '资格审查',
    '分数线', '成绩公告', '成绩查询', '面试名单', '拟聘', '拟任', '拟任职',
    '就业促进', '绩效', '职称', '职业资格', '答题卡', '人选公示',
    '特聘人员公示', '博士后', '资助对象', '表彰推', '专业技术人才', '技能大奖',
  ];
  for (const keyword of blacklist) {
    if (title.includes(keyword)) {
      return false;
    }
  }

  const whitelist = ['招聘', '招考', '招录', '公开招', '公开招聘', '公开考试', '遴选', '选调'];
  for (const keyword of whitelist) {
    if (title.includes(keyword)) {
      return true;
    }
  }

  // 模糊情况调用 AI
  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: '你是招考公告分类器。判断标题是否为招聘/招考公告（事业单位、公务员、教师、医疗等）。只回复 YES 或 NO。',
        },
        {
          role: 'user',
          content: `标题：${title}`,
        },
      ],
    });

    const answer = response.response.trim().toUpperCase();
    return answer === 'YES';
  } catch (err) {
    console.error(`AI 调用失败: ${err.message}`);
    return true; // 失败时保守保留
  }
}
