# 考情监测 · 前端

事业单位招考信息自动化监测平台前端，基于 **Next.js 14 App Router** + **TypeScript** + **Tailwind CSS**，由 `design-final.html` 设计稿落地。

## 技术栈

| 项 | 选型 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript (strict) |
| 样式 | Tailwind CSS + OKLCH CSS Variables |
| 图标 | lucide-react |
| 部署 | Cloudflare Pages（可选） |

## 快速开始

```bash
cd frontend
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

开发环境下若 API 未启动，会自动回退到 `lib/mock-data.ts` 中的示例数据。

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

| 变量 | 说明 |
|---|---|
| `API_PROXY_TARGET` | `next.config` rewrites 代理目标，默认 `http://127.0.0.1:8787` |
| `API_BASE_URL` | 服务端直连 API 基址（可选） |
| `NEXT_PUBLIC_API_BASE_URL` | 浏览器端 API 基址（一般留空） |
| `USE_MOCK=1` | 强制使用 mock 数据 |

## 项目结构

```
frontend/
├── app/
│   ├── layout.tsx              # 根布局 + SEO metadata + Inter 字体
│   ├── page.tsx                # 首页（Hero + Stats + Filter + 列表）
│   ├── loading.tsx             # 路由级 loading
│   ├── not-found.tsx           # 404
│   ├── about/page.tsx          # 关于 / 帮助 / 提交
│   └── announcements/[id]/    # 公告详情
├── components/
│   ├── Header.tsx
│   ├── Hero.tsx
│   ├── Stats.tsx
│   ├── AnnouncementItem.tsx
│   ├── Filter.tsx
│   ├── Pagination.tsx
│   ├── Footer.tsx
│   ├── LoadingState.tsx
│   └── ErrorState.tsx
├── lib/
│   ├── api.ts                  # fetch 封装 + mock 回退
│   ├── format.ts               # 展示格式化
│   └── mock-data.ts
├── types/index.ts
├── tailwind.config.ts          # OKLCH 色彩映射
├── next.config.mjs             # API rewrites
└── wrangler.toml               # Cloudflare Pages 说明
```

## API 约定

前端通过 `/api/*` 调用后端（本地由 Next rewrites 转发到 Workers）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/announcements` | 列表，支持 `region` / `examType` / `page` |
| GET | `/api/announcements/:id` | 详情 |
| GET | `/api/stats` | 统计 |
| GET | `/api/regions` | 地区列表 |

同时启动 API（仓库根目录 `api/`）：

```bash
cd ../api && npm run dev   # 默认 :8787
cd ../frontend && npm run dev
```

## 样式要点

- **OKLCH** 色彩空间 + 马卡龙强调色（mint / peach / pink / lemon / lavender）
- **8pt** 间距系统（`--space-1` … `--space-10`）
- **0px** 圆角（方形设计）
- 微交互：统计卡左边框加宽、公告 hover 左边框展开
- `prefers-reduced-motion` 降级

## 脚本

```bash
npm run dev      # 开发
npm run build    # 生产构建
npm run start    # 启动生产服务
npm run lint     # ESLint
```

## Cloudflare Pages 部署

### 控制台连接 Git

| 配置 | 值 |
|---|---|
| Framework preset | Next.js |
| Root directory | `frontend` |
| Build command | `npx @cloudflare/next-on-pages@1` 或 `npm run build` |
| Build output | `.vercel/output/static`（next-on-pages） |

### 环境变量（生产）

```
NEXT_PUBLIC_API_BASE_URL=https://your-api.workers.dev
```

生产环境建议前端直连 Workers API 域名，避免 Pages 上 rewrites 依赖本机端口。

### Wrangler CLI

```bash
npm install -D @cloudflare/next-on-pages
npx @cloudflare/next-on-pages
npx wrangler pages deploy .vercel/output/static --project-name=kaoqing-frontend
```

详见 [Cloudflare Next.js 指南](https://developers.cloudflare.com/pages/framework-guides/nextjs/)。

## 验收清单

- [x] `npm run dev` 可本地运行
- [x] 页面样式对齐 `design-final.html`
- [x] 响应式（lg 侧栏折叠、md 单列统计）
- [x] 组件 TypeScript 类型
- [x] API loading / error / mock 回退
- [x] SEO metadata + a11y 标签
