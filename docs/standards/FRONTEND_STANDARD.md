# 前端开发规范（Next.js 14 静态导出）

**适用范围**：`frontend/` 目录（Next.js 14.2.35 + TypeScript + Tailwind）
**强制约束**：所有子代理开发必须遵循本规范，代码审查按本规范验收

---

## 1. 技术栈基线

| 项 | 版本/配置 | 说明 |
|---|---|---|
| Next.js | 14.2.35 | `output: 'export'` 静态导出 |
| TypeScript | strict 模式 | `tsconfig.json` 已开启 |
| Tailwind | 3.x + OKLCH CSS 变量 | 配色走 CSS 变量，禁止裸色值 |
| 图标 | lucide-react | 禁止引入其他图标库 |
| API | `lib/api.ts` 封装 | 禁止组件内直接 fetch |

## 2. 目录结构（保持现状，新增按此）

```
frontend/
├── app/                    # App Router 路由
│   ├── page.tsx            # 首页（考情总览）
│   ├── announcement/       # 公告详情页
│   ├── about/              # 关于页
│   ├── layout.tsx          # 根布局
│   └── globals.css
├── components/             # 组件（一个文件一个组件）
│   ├── HomeClient.tsx      # 首页客户端逻辑
│   ├── Filter.tsx          # 筛选器
│   ├── Stats.tsx           # 统计卡片
│   ├── AnnouncementItem.tsx
│   └── ...
├── lib/                    # 业务逻辑
│   ├── api.ts              # API 客户端（唯一 fetch 入口）
│   ├── format.ts           # 格式化工具
│   ├── mock-data.ts        # ⚠️ 仅开发用，生产路径禁止引用
│   └── types.ts
├── next.config.mjs
└── tailwind.config.ts
```

## 3. 命名规范

| 项 | 规则 | 示例 |
|---|---|---|
| 组件文件 | PascalCase | `AnnouncementItem.tsx` |
| 组件名 | PascalCase | `export default function AnnouncementItem` |
| 非组件文件 | kebab-case | `mock-data.ts` |
| 函数/变量 | camelCase | `fetchAnnouncements` |
| 类型/接口 | PascalCase | `interface Announcement` |
| CSS 类 | Tailwind 原子类 | 禁止手写 CSS 类名 |

## 4. TypeScript 强制规则

- 所有组件 props 必须有类型定义（interface 或 type），禁止 `any`
- 所有 API 返回必须定义类型（见 `lib/types.ts`）
- 禁止 `@ts-ignore` / `@ts-expect-error`
- 可选字段显式标注 `| null` 而非 `| undefined`（与 API 契约一致）
- 数据行类型：`RawAnnouncement`（snake_case 原值）→ `Announcement`（camelCase 规范值），转换在 `lib/api.ts` 的 `normalizeAnnouncement()` 统一完成

## 5. API 调用规范（核心）

```typescript
// lib/api.ts — 唯一 fetch 入口，组件禁止直接 fetch
export async function fetchAnnouncements(params: AnnouncementQueryParams): Promise<AnnouncementListResponse> {
  // ...
}

// 组件内使用（HomeClient.tsx 模式）
useEffect(() => {
  setLoading(true);
  Promise.all([fetchAnnouncements(params), fetchStats()])
    .then(([list, stats]) => { /* setState */ })
    .catch((err) => { setListError(err.message); })
    .finally(() => setLoading(false));
}, [params]);
```

**错误处理规范（重要）**：
- ❌ 禁止 `fetchStats().catch(() => MOCK_STATS)` 静默吞错
- ✅ 失败时设置 error state，展示 `<ErrorState message={...} />`
- ✅ mock 数据仅限 `NODE_ENV === 'development' || USE_MOCK === '1'` 时使用
- ✅ 加载态用 `<LoadingState />`，错误态用 `<ErrorState />`（已存在组件复用）

## 6. 数据展示规范

- 字段缺失显示：按 `is_known` 语义渲染（known=值 / unknown=灰"待确认" / na=横杠 / none="无"）
- 日期统一走 `lib/format.ts` 的格式化函数，禁止组件内手写格式化
- 空列表显示空态组件，禁止空白页
- 所有时间字段展示"来源+采集时间"（合规要求）
- 详情页必须包含"查看原文"外链（`target="_blank" rel="noopener noreferrer"`）

## 7. 样式规范（Tailwind + OKLCH）

- 颜色**只允许**使用 `tailwind.config.ts` 中定义的语义色（bg-primary/text-primary/accent-mint 等 CSS 变量），禁止 `bg-red-500` 等裸色
- 间距用 Tailwind 间距体系，禁止魔法数字 `style={{marginTop: 13}}`
- 组件复用：卡片、徽标、按钮等通用 UI 抽为共享组件（components/index.ts 导出）
- 响应式：移动优先，`sm:`/`md:` 断点

## 8. 禁止事项

- 禁止生产路径 import `mock-data.ts`
- 禁止在服务端组件里使用浏览器 API（`window`/`document`）
- 禁止内联样式对象做布局（样式走 className）
- 禁止重复定义 `api.ts` 已有的类型/函数
- 禁止引入未在 package.json 的依赖（如需新增必须说明理由）

## 9. 提交/验收清单

- [ ] `npm run build` 通过（静态导出无报错）
- [ ] `npm run lint` 通过
- [ ] `tsc --noEmit` 无类型错误
- [ ] 生产路径无 mock 数据引用
- [ ] 所有 fetch 有 loading/error 态
- [ ] 无 `any`、无 `@ts-ignore`
- [ ] 颜色全部走语义 CSS 变量

## §TDD 章节（2026-08-20 追加）

**强制**：任何新增/修改组件或 lib 函数，必须先写测试（红）→ 实现（绿）→ 重构。

- 测试框架：vitest + @testing-library/react + jsdom
- 文件位置：`frontend/__tests__/*.test.{ts,tsx}`
- 运行：`cd frontend && npm test`（=`vitest run`）
- 用例覆盖：组件渲染 / 用户交互（点击/输入）/ 数据绑定 / 错误态 / sessionStorage 记忆
- 禁止：无测试的组件合入；只测 happy path 不测错误态
