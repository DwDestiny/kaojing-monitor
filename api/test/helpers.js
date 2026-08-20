/**
 * 测试辅助工具（非测试文件，node --test 只匹配 *.test.js）
 * 提供：mock D1 对象 + 构造 fetch 请求的便捷函数
 */

/**
 * 构造可编程的 mock D1 对象
 * script 数组按 prepare().bind() 或 prepare().run()/all()/first() 的调用顺序逐条消耗；
 * 未配置的步骤走安全默认值。所有调用的 {sql, args} 会被记录到 db.calls，便于断言落库参数。
 * 兼容两种真实 D1 用法：prepare().bind(...).all() 与 prepare().all()（无参数直调）。
 */
export function makeDb(options = {}) {
  const calls = [];
  const script = options.script || [];
  let idx = 0;

  // 消耗并返回下一个脚本步骤
  function takeStep() {
    const step = script[idx] || {};
    idx += 1;
    return step;
  }

  // 构造可执行对象
  function buildExecutables(sql, args, step) {
    return {
      async run() {
        if (step.run) return step.run(args, calls);
        return { meta: { changes: 1 }, results: [] };
      },
      async all() {
        if (step.all) return step.all(args, calls);
        return { results: [] };
      },
      async first() {
        if (step.first !== undefined) {
          return typeof step.first === 'function' ? step.first(args, calls) : step.first;
        }
        return null;
      },
    };
  }

  const db = {
    calls,
    prepare(sql) {
      const stmt = {
        bind(...args) {
          calls.push({ sql, args });
          return buildExecutables(sql, args, takeStep());
        },
      };
      // 无参数直调：prepare().all() / prepare().run() / prepare().first()
      stmt.run = async () => {
        calls.push({ sql, args: [] });
        return buildExecutables(sql, [], takeStep()).run();
      };
      stmt.all = async () => {
        calls.push({ sql, args: [] });
        return buildExecutables(sql, [], takeStep()).all();
      };
      stmt.first = async () => {
        calls.push({ sql, args: [] });
        return buildExecutables(sql, [], takeStep()).first();
      };
      return stmt;
    },
  };
  return db;
}

/**
 * 构造指向本地 worker 的 fetch 请求
 */
export function apiRequest(pathname, { method = 'GET', body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!init.headers['Content-Type']) {
      init.headers['Content-Type'] = 'application/json';
    }
  }
  return new Request(`http://localhost${pathname}`, init);
}
