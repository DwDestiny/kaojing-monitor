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
  const blacklist = ['证书发放', '档案', '公示名单', '拟聘用', '体检通知', '资格审查结果'];
  const whitelist = ['招聘', '招考', '招录', '公开招', '遴选', '选调'];

  return announcements.filter(item => {
    const title = item.title;

    // 黑名单优先
    for (const keyword of blacklist) {
      if (title.includes(keyword)) {
        console.log(`  ❌ 规则过滤: ${title}`);
        return false;
      }
    }

    // 白名单检查
    for (const keyword of whitelist) {
      if (title.includes(keyword)) {
        return true;
      }
    }

    // 默认保留（避免误杀）
    return true;
  });
}

/**
 * 判断标题是否为招考公告
 */
async function isRecruitmentAnnouncement(title, env) {
  // 快速规则过滤（优先级高，避免浪费 AI 额度）
  const blacklist = ['证书发放', '档案', '公示名单', '拟聘用', '体检通知', '资格审查'];
  for (const keyword of blacklist) {
    if (title.includes(keyword)) {
      return false;
    }
  }

  const whitelist = ['招聘', '招考', '招录', '公开招', '遴选', '选调'];
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
