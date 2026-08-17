# 考情监测系统 - 部署计划

**检查时间**: 2026-08-17 17:45

---

## 🔐 环境检查结果

### ✅ GitHub
- **状态**: 已登录
- **账号**: DwDestiny
- **权限**: repo, workflow, gist, read:org
- **协议**: HTTPS

### ⚠️ Cloudflare
- **Wrangler**: 未安装
- **需要**: 安装 wrangler CLI + 登录

---

## 📋 部署计划

### 阶段 1: 环境准备

#### 1.1 安装 Cloudflare Wrangler
```bash
cd api
npm install
# wrangler 会作为 devDependency 安装
```

#### 1.2 登录 Cloudflare
```bash
npx wrangler login
# 会打开浏览器进行 OAuth 认证
```

#### 1.3 验证登录
```bash
npx wrangler whoami
```

---

### 阶段 2: Cloudflare D1 数据库

#### 2.1 创建 D1 数据库
```bash
cd api
npx wrangler d1 create kaojing-db
```

**输出示例**:
```
✅ Successfully created DB 'kaojing-db'
[[d1_databases]]
binding = "DB"
database_name = "kaojing-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

#### 2.2 更新 wrangler.toml
将返回的 `database_id` 填入 `api/wrangler.toml`

#### 2.3 执行建表 SQL
```bash
# 方法 1: 通过 wrangler 执行（推荐）
npx wrangler d1 execute kaojing-db --file=../database/schema-d1.sql

# 方法 2: 远程执行
npx wrangler d1 execute kaojing-db --remote --file=../database/schema-d1.sql
```

#### 2.4 导入网站配置数据
```bash
npx wrangler d1 execute kaojing-db --file=../database/init-websites.sql
```

#### 2.5 导入公告数据
```bash
# 由于文件较大（1.06 MB），可能需要分批导入
npx wrangler d1 execute kaojing-db --file=../crawlers/output/import-data.sql
```

**注意**: 如果文件过大导入失败，需要拆分成多个文件

#### 2.6 验证数据
```bash
npx wrangler d1 execute kaojing-db --command="SELECT COUNT(*) FROM announcements"
npx wrangler d1 execute kaojing-db --command="SELECT * FROM announcements LIMIT 5"
```

---

### 阶段 3: 部署 API (Cloudflare Workers)

#### 3.1 本地测试
```bash
cd api
npx wrangler dev
# 访问 http://localhost:8787/api/announcements
```

#### 3.2 部署到生产环境
```bash
npx wrangler deploy
```

**输出示例**:
```
✨ Built successfully
✨ Uploaded kaojing-api
✨ Published kaojing-api
  https://kaojing-api.your-account.workers.dev
```

#### 3.3 测试生产 API
```bash
curl https://kaojing-api.your-account.workers.dev/api/announcements
curl https://kaojing-api.your-account.workers.dev/api/stats
```

---

### 阶段 4: 部署前端 (Cloudflare Pages)

#### 4.1 准备前端项目
```bash
cd frontend
npm install
npm run build
```

#### 4.2 连接到 Cloudflare Pages

**方法 1: 通过 GitHub 自动部署（推荐）**

1. 将代码推送到 GitHub
   ```bash
   cd /Users/dw/Desktop/张晗/粉笔/考情监测
   git init
   git add .
   git commit -m "Initial commit: 考情监测系统"
   gh repo create kaojing-monitor --public --source=. --remote=origin --push
   ```

2. 在 Cloudflare Pages 创建项目
   - 访问: https://dash.cloudflare.com/pages
   - 点击 "Create a project"
   - 选择 "Connect to Git"
   - 选择仓库: `kaojing-monitor`
   - 构建配置:
     - Framework preset: `Next.js`
     - Build command: `npm run build`
     - Build output directory: `.next`
     - Root directory: `frontend`

3. 配置环境变量
   ```
   NEXT_PUBLIC_API_BASE_URL = https://kaojing-api.your-account.workers.dev
   ```

**方法 2: 通过 Wrangler 直接部署**
```bash
cd frontend
npx wrangler pages deploy .next --project-name=kaojing-monitor
```

#### 4.3 测试前端
访问 Cloudflare Pages 提供的 URL: `https://kaojing-monitor.pages.dev`

---

### 阶段 5: 配置定时任务

#### 5.1 实现定时爬取逻辑

在 `api/src/index.js` 的 `scheduled` 函数中：
```javascript
async scheduled(event, env, ctx) {
  console.log('Cron triggered at:', new Date().toISOString());
  
  // 调用爬虫逻辑
  // 由于 Workers 环境限制，需要将爬虫逻辑改写或通过外部服务触发
}
```

**注意**: Cloudflare Workers 有执行时间限制（CPU 时间 50ms 免费版），爬虫任务可能超时。

**解决方案**:
- **方案 A**: 使用 Cloudflare Workers 触发外部爬虫服务（如 GitHub Actions）
- **方案 B**: 将爬虫逻辑简化，仅触发轻量级任务
- **方案 C**: 使用 Durable Objects 进行长时间任务

#### 5.2 Cron 配置（已在 wrangler.toml）
```toml
[triggers]
crons = ["7 2 * * *", "23 14 * * *"]
```

---

### 阶段 6: 监控和日志

#### 6.1 查看 Workers 日志
```bash
npx wrangler tail
```

#### 6.2 查看 Pages 日志
通过 Cloudflare Dashboard 查看部署日志

#### 6.3 配置告警（可选）
在 Cloudflare Dashboard 设置告警规则

---

## ⚠️ 已知限制和注意事项

### 1. SQL 文件大小限制
- D1 单次执行有大小限制
- `import-data.sql` (1.06 MB) 可能需要拆分

**解决方案**: 创建拆分脚本
```bash
split -l 100 import-data.sql import-data-part-
```

### 2. Workers 定时任务限制
- CPU 时间限制: 50ms (免费版)
- 爬虫任务可能超时

**解决方案**: 
- 使用 GitHub Actions 作为爬虫执行环境
- Workers Cron 仅触发 GitHub Actions workflow

### 3. D1 数据库限制
- 免费版: 5GB 存储，100,000 次读取/天
- 当前数据量: 1424 条，完全足够

### 4. 跨域问题
- API 已配置 CORS: `Access-Control-Allow-Origin: *`
- 如果遇到问题，检查 wrangler.toml 的 routes 配置

---

## 🔄 备选方案：混合架构

如果 Workers 定时任务不适合爬虫：

### 方案 A: GitHub Actions + Workers
- **爬虫**: GitHub Actions (每天定时运行)
- **数据存储**: Cloudflare D1
- **API**: Cloudflare Workers
- **前端**: Cloudflare Pages

**优点**: 
- 爬虫无时间限制
- 完全免费
- 易于调试

**实现**:
1. 爬虫代码放在 `.github/workflows/crawl.yml`
2. 定时运行，生成数据
3. 通过 Workers API 写入 D1

### 方案 B: 独立爬虫服务
- **爬虫**: Render / Railway / Fly.io 免费层
- **其他**: 同方案 A

---

## 📝 部署检查清单

- [ ] 安装 wrangler
- [ ] 登录 Cloudflare
- [ ] 创建 D1 数据库
- [ ] 更新 database_id
- [ ] 执行建表 SQL
- [ ] 导入数据
- [ ] 验证数据
- [ ] 部署 Workers API
- [ ] 测试 API
- [ ] 构建前端
- [ ] 推送到 GitHub
- [ ] 配置 Pages 项目
- [ ] 配置环境变量
- [ ] 测试前端
- [ ] 配置定时任务
- [ ] 设置监控

---

## 🚀 快速部署命令（顺序执行）

```bash
# 1. 安装依赖
cd /Users/dw/Desktop/张晗/粉笔/考情监测/api
npm install

# 2. 登录 Cloudflare
npx wrangler login

# 3. 创建 D1 数据库
npx wrangler d1 create kaojing-db

# 4. 更新 wrangler.toml（手动填入 database_id）

# 5. 建表
npx wrangler d1 execute kaojing-db --file=../database/schema-d1.sql

# 6. 导入网站配置
npx wrangler d1 execute kaojing-db --file=../database/init-websites.sql

# 7. 导入公告数据（可能需要拆分）
npx wrangler d1 execute kaojing-db --file=../crawlers/output/import-data.sql

# 8. 本地测试 API
npx wrangler dev

# 9. 部署 API
npx wrangler deploy

# 10. 推送到 GitHub
cd ..
git init
git add .
git commit -m "Initial commit"
gh repo create kaojing-monitor --public --source=. --push

# 11. 配置 Cloudflare Pages（手动操作）

# 12. 测试完整流程
```

---

**准备好了吗？开始执行部署！**
