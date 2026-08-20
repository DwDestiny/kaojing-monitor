# 考情监测 · 视觉设计规范（Design System）

> 版本：v2.0（2026-08-20）
> 定位：事业单位/公务员招考公告聚合站（列表 + 详情 + 筛选 + 统计）
> 风格关键词：**现代、扁平、干净、编辑出版感**（编辑部白纸黑字，而非彩色色块）
> 兼容性：Next.js 14 + Tailwind 3 + OKLCH CSS 变量。**保持现有语义类名体系**（`bg-primary` / `text-primary` / `divider` / `space-*`），迁移期只改 `:root` 变量 + 少量组件微调。

---

## 1. 设计原则

### P1 中性为骨，墨绿为魂
页面底色近白、文字近墨，全站只保留**一个品牌强调色：墨绿**（编辑出版感的深青绿）。强调色只用于关键操作（主按钮、链接、激活态）与状态提示，**绝不铺满背景**。废除马卡龙五色块。

### P2 线面分离，拒绝卡片堆砌
不用色块卡、不用重阴影、不用毛玻璃。层次靠「1px 分隔线 + 留白 + 字号层级」表达：区块之间用线，内容之间用留白，轻重靠字号与字重。列表项一律细线分隔，像报纸目录。

### P3 信息密度优先
标题清晰、辅助信息退到次级灰。每一个视觉元素都必须承载信息，装饰性元素（彩色边框、悬停位移、渐变）一律不引入。数字用等宽数字（`tabular-nums`），让"招聘 128 人"这类数据整齐对齐。

### P4 微圆角，克制过渡
圆角 4–8px（微圆角），只用来柔化按钮、标签、输入框，**不再套卡片**。过渡只用 `150–200ms` 的颜色变化（hover 变强调色），不做位移、不做缩放。

### P5 移动优先，单列优先
移动端一律单列，桌面端 1024px 起才出现侧栏 + 列表的两列布局。任何层级的划分在移动端退化为"分隔线 + 分组标题"。

---

## 2. 色彩令牌表

所有颜色走 `:root` CSS 变量（OKLCH，L 0–1、C 0–0.4、H 0–360），Tailwind 映射为语义类。组件禁止裸色值。

### 2.1 中性色（近白底 / 深墨字，编辑出版感）

| 变量名 | OKLCH 值 | Tailwind 类 | 用途 |
|---|---|---|---|
| `--bg-primary` | `oklch(99% 0.003 95)` | `bg-bg-primary` | 页面主背景（微暖纸白） |
| `--bg-secondary` | `oklch(97.2% 0.004 95)` | `bg-bg-secondary` | 次级背景：页头、详情标题区、输入框底色、浅灰标签底 |
| `--text-primary` | `oklch(24% 0.012 275)` | `text-text-primary` | 正文/标题（深墨近黑） |
| `--text-secondary` | `oklch(45% 0.01 275)` | `text-text-secondary` | 辅助文字、导航项、正文次要信息 |
| `--text-tertiary` | `oklch(62% 0.01 275)` | `text-text-tertiary` | 弱化信息：标签文字、计数、caption、占位符 |
| `--divider` | `oklch(91.5% 0.005 90)` | `border-divider` | 1px 分隔线（微暖浅灰） |

### 2.2 品牌强调色（唯一强调色：墨绿）

| 变量名 | OKLCH 值 | Tailwind 类 | 用途 |
|---|---|---|---|
| `--accent` | `oklch(40% 0.07 168)` | `bg-accent` / `text-accent` / `border-accent` | 品牌主色：主按钮底、激活态文字、链接 hover、强调下划线 |
| `--accent-strong` | `oklch(34% 0.065 168)` | `bg-accent-strong` | 强调色按下/hover 加深（按钮 hover、按下） |
| `--accent-subtle` | `oklch(94% 0.02 168)` | `bg-accent-subtle` | 强调色极浅底：激活筛选项背景、选中行背景 |
| `--accent-subtle-text` | `oklch(36% 0.07 168)` | `text-accent-subtle-text` | 浅底上的强调文字（可读性优先） |
| `--accent-contrast` | `oklch(99% 0 0)` | `text-accent-contrast` | 强调底上的文字（主按钮上的近白字） |

> 附注：`--accent` 在 Tailwind `colors` 中注册为 `accent` 键后，`bg-accent` / `text-accent` / `hover:text-accent` 直接可用；若担心与 Tailwind 原生 `accent-*`（表单控件 `accent-color`）前缀混淆，可将该键另注册为 `brand` 别名，值不变。

### 2.3 状态色（克制使用，只出现在状态徽标/状态文字）

| 变量名 | OKLCH 值 | Tailwind 类 | 语义 |
|---|---|---|---|
| `--status-open` | `oklch(55% 0.19 27)` | `border-status-open` | 报名中（红） |
| `--status-open-subtle` | `oklch(95% 0.02 27)` | `bg-status-open-subtle` | 报名中徽标底色（极浅红） |
| `--status-open-text` | `oklch(48% 0.17 27)` | `text-status-open-text` | 报名中文字（深红，白底上 >4.5:1） |
| `--status-closed` | `oklch(58% 0.01 275)` | `border-status-closed` | 已结束（灰） |
| `--status-closed-subtle` | `oklch(94% 0.004 275)` | `bg-status-closed-subtle` | 已结束徽标底色（浅灰） |
| `--status-closed-text` | `oklch(48% 0.01 275)` | `text-status-closed-text` | 已结束文字（中灰） |
| `--status-note` | `oklch(62% 0.13 152)` | `border-status-note` | 免笔试（绿） |
| `--status-note-subtle` | `oklch(95% 0.02 152)` | `bg-status-note-subtle` | 免笔试徽标底色（极浅绿） |
| `--status-note-text` | `oklch(45% 0.11 152)` | `text-status-note-text` | 免笔试文字（深绿） |

> 状态色使用纪律：状态只出现在**徽标**上，一次至多一个；正文、背景、按钮不得使用状态色。

### 2.4 圆角与间距

| 变量名 | 值 | 用途 |
|---|---|---|
| `--radius-sm` | `4px` | 标签、小徽标、输入框 |
| `--radius`（DEFAULT） | `6px` | 按钮、次级面板（保留变量名，值由 0 → 6px） |
| `--radius-lg` | `8px` | 弹窗、较大容器 |

间距沿用 8pt 系统，新增一个半格：

| 变量名 | 值 | 用途 |
|---|---|---|
| `--space-1` | `8px` | 紧凑间隙、标签间距 |
| `--space-1-5` | `12px` | 标题与副信息的间隔（半格） |
| `--space-2` | `16px` | 常规组件内间隙 |
| `--space-3` | `24px` | 区块内间距、列表项垂直留白 |
| `--space-4` | `32px` | 区块间间距 |
| `--space-5` | `40px` | 大区块、页面左右边距（桌面） |
| `--space-6` / `--space-8` / `--space-10` | `48px` / `64px` / `80px` | 页面级留白 |

### 2.5 旧马卡龙变量的迁移别名（过渡期保留，最后删除）

为了让现有组件**不改类名**也能自动落到新风格，旧变量重定义为中性/语义值：

| 旧变量 | 新值（过渡别名） | 效果 |
|---|---|---|
| `--accent-mint` | `oklch(94% 0.02 168)` | 旧"薄荷底"→ 浅墨绿底 |
| `--accent-mint-text` | `oklch(36% 0.07 168)` | 旧"薄荷字"→ 深墨绿字 |
| `--accent-peach` / `--accent-lemon` / `--accent-lavender` | `oklch(95% 0.004 90)` | 旧彩色底 → 中性浅灰底 |
| `--accent-peach-text` / `--accent-lemon-text` / `--accent-lavender-text` | `oklch(40% 0.01 275)` | 旧彩色字 → 中性深灰字 |
| `--accent-pink` | `oklch(95% 0.02 27)` | 旧"粉底"（新/热徽标）→ 浅红底 |
| `--accent-pink-text` | `oklch(48% 0.17 27)` | 旧"粉字"→ 深红字 |

---

## 3. 字体与字号系统

### 3.1 字体栈（中文场景，系统字体优先）

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro SC", "PingFang SC",
    "Hiragino Sans GB", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei",
    "Segoe UI", Roboto, sans-serif;
}
```

- 中文走 `PingFang SC` / `Noto Sans SC`，英文数字走 `-apple-system` 的 SF 系。
- **数字一律 `tabular-nums`**（Tailwind 内置类），保证"招聘人数 / 笔试日期 / 计数"纵向对齐。
- 标题加大负字距（`tracking-[-0.02em]`），正文保持默认，营造编辑排版感。
- 不加粗装饰、不引入衬线/书法体。

### 3.2 字号层级

| 层级 | 字号/行高 | 字重 | 字距 | 用途 |
|---|---|---|---|---|
| Display | `32px / 1.25`（移动 28px） | 700 | `-0.02em` | 首页大标题、详情页标题 |
| H2 | `20px / 1.35` | 600 | `-0.015em` | 区块标题、弹窗标题 |
| H3 | `16px / 1.5` | 600 | 0 | 分组标题 |
| 正文 Body | `15px / 1.6` | 400 | 0 | 列表正文、详情信息 |
| 辅助 Body-sm | `13px / 1.5` | 400 | 0 | 列表元信息、按钮辅助说明 |
| Caption | `12px / 1.4` | 500 | `0.08em`（大写） | 分组标签、统计卡标签、徽标 |
| 大数字 | `40px / 1.1` | 700 | `-0.02em` + `tabular-nums` | 统计卡片数值 |

> 层级纪律：同一屏内层级不超过 4 档；辅助信息**必须**用 `text-text-secondary` / `text-text-tertiary`，不得用主色文字+缩小来冒充辅助层级。

---

## 4. 组件样式规范

### 4.1 按钮

| 类型 | 默认 | 悬停 | 按下 | 禁用 | 说明 |
|---|---|---|---|---|---|
| **主按钮** btn-primary | 墨绿底 `bg-accent` + 近白字 `text-accent-contrast` | `bg-accent-strong` | `bg-accent-strong` | `opacity-50` `cursor-not-allowed` | 唯一关键操作：查看原文、提交反馈、提交新网站 |
| **次按钮** btn-secondary | 透明底 + 1px `border-divider` + 主文字 | `bg-bg-secondary` + 边框 `text-tertiary` | 同悬停 | `opacity-50` | 返回列表、取消等辅助操作 |
| **文字按钮** btn-ghost | `text-text-secondary` | `text-accent` | `text-accent-strong` | `opacity-50` | 页头导航、页脚链接等弱操作 |

```tsx
// 主按钮
<a className="inline-flex items-center gap-2 rounded-[6px] bg-accent px-space-4 py-2.5
              text-[14px] font-medium text-accent-contrast no-underline
              transition-colors duration-150 hover:bg-accent-strong disabled:opacity-50">
  查看原文 <ExternalLink className="h-4 w-4" aria-hidden />
</a>

// 次按钮
<a className="inline-flex items-center gap-2 rounded-[6px] border border-divider px-space-4 py-2.5
              text-[14px] font-medium text-text-primary no-underline
              transition-colors duration-150 hover:border-text-tertiary hover:bg-bg-secondary">
  返回列表
</a>

// 文字按钮
<a className="text-[14px] font-medium text-text-secondary no-underline transition-colors
              duration-150 hover:text-accent">
  提交新网站
</a>
```

### 4.2 筛选条（侧栏）

- 布局：分组标题（Caption 层级，`text-text-tertiary` uppercase）+ 垂直链接列表；移动端退化为横向滚动条。
- 链接：行内 `py-1.5`，计数右对齐 `text-text-tertiary`。
- 激活态：**主文字变墨绿 + 左侧 2px 强调竖线 + 极浅墨绿底**（三选一即可，推荐竖线 + 墨绿字）。
- 悬停：`text-text-primary` → `text-accent`。

```tsx
<Link className={`relative flex items-center justify-between py-1.5 pr-space-1 text-[15px]
                 no-underline transition-colors duration-150 ${
                   active
                     ? "border-l-2 border-accent pl-space-1 font-medium text-accent"
                     : "border-l-2 border-transparent pl-space-1 font-normal text-text-secondary hover:text-accent"
                 }`}>
  <span>{label}</span>
  <span className="text-[13px] text-text-tertiary">{count}</span>
</Link>
```

### 4.3 标签徽标（状态 / 类型）

| 类型 | 样式 | 类 |
|---|---|---|
| **状态·报名中** | 极浅红底 + 深红字 + 前置红点 | `rounded-[4px] bg-status-open-subtle px-2 py-0.5 text-[12px] font-medium text-status-open-text` |
| **状态·已结束** | 浅灰底 + 中灰字 | `rounded-[4px] bg-status-closed-subtle px-2 py-0.5 text-[12px] font-medium text-status-closed-text` |
| **状态·免笔试** | 极浅绿底 + 深绿字 | `rounded-[4px] bg-status-note-subtle px-2 py-0.5 text-[12px] font-medium text-status-note-text` |
| **类型/地区/科目** | 浅灰底 + 1px 细边 + 次级灰字（中性，弱化） | `rounded-[4px] border border-divider bg-bg-secondary px-2 py-0.5 text-[12px] font-medium text-text-secondary` |
| **新 / 热** | 强调色小圆点 + 强调色文字（不铺底色） | `inline-flex items-center gap-1 text-[12px] font-semibold text-accent`（前置 `h-1.5 w-1.5 rounded-full bg-accent`） |

> 徽标纪律：一行内类型标签 ≤ 3 个、状态徽标 ≤ 1 个；类型标签一律中性，只有状态才允许带色。

```tsx
// 状态徽标（列表项右侧）
<span className="inline-flex items-center gap-1.5 rounded-[4px] bg-status-open-subtle
                 px-2 py-0.5 text-[12px] font-medium text-status-open-text">
  <span className="h-1.5 w-1.5 rounded-full bg-status-open" aria-hidden />
  报名中
</span>

// 类型标签
<span className="rounded-[4px] border border-divider bg-bg-secondary px-2 py-0.5
               text-[12px] font-medium text-text-secondary">{region}</span>
```

### 4.4 列表项（公告列表）

- **无卡片**：`bg-transparent`，无边框容器，仅靠 `border-b border-divider` 细线分隔。
- 结构三行：标题（16px 主文字）→ 元信息（13px 次级灰，`地区 · 招聘 N 人 · 笔试 日期 · 科目`）→ 标签行。
- 悬停：标题变 `text-accent`，整行背景不变（扁平）。
- 响应式：移动端标题 16px、元信息纵向排列（`flex-col`）。

```tsx
<li className="group border-b border-divider px-space-1 py-space-3">
  <div className="flex items-start gap-space-3">
    <div className="min-w-0 flex-1">
      <a href={`/announcement?id=${id}`}
         className="text-[16px] font-medium leading-normal tracking-[-0.01em]
                    text-text-primary no-underline transition-colors duration-150
                    group-hover:text-accent">
        {title}
      </a>
      <p className="mt-space-1-5 text-[13px] text-text-secondary">
        {region} · 招聘 {formatRecruitCount(recruitCount)} 人 · 笔试 {formatExamSchedule(...)}
      </p>
      <div className="mt-space-1 flex flex-wrap gap-1.5">
        {/* 中性类型标签，见 4.3 */}
      </div>
    </div>
    {/* 状态徽标（可选的，右侧） */}
  </div>
</li>
```

### 4.5 统计卡片

- **取消彩色左边框条与色块**（删除 `stat-item-*` 与 `::before`）。改为"顶部 2px 强调细线 + 底部 1px 分隔线"的横排单元，编辑部仪表盘风格。
- 结构：Caption 标签（uppercase 灰）→ 大数字（`tabular-nums` 40px）→ 一行说明（13px 次级灰）。
- 响应式：移动端单列、`sm` 两列、`lg` 三列；每列底部 `border-b`，`lg` 下列间加 `border-r`。

```tsx
<article className="border-t-2 border-accent pt-space-3 pb-space-3 lg:border-b-0
                    border-b border-divider">
  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
    {label}
  </div>
  <div className="mt-space-1 text-[40px] font-bold leading-[1.1] tracking-[-0.02em]
                  tabular-nums text-text-primary">
    {value}
  </div>
  <div className="mt-space-1 text-[13px] text-text-secondary">{change}</div>
</article>
```

### 4.6 详情页信息行（dl 网格）

- 无容器背景，行间 1px 分隔线；`md` 起两列，列内行间分隔线连续（编辑器印刷感）。
- label：12px uppercase 灰；value：16px 主文字。

```tsx
<div className="border-b border-divider px-space-5 py-space-3 md:px-space-3">
  <dt className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
    {label}
  </dt>
  <dd className="text-[16px] font-medium text-text-primary">{value}</dd>
</div>
```

### 4.7 反馈表单

- 输入框：1px `border-divider` + `bg-bg-secondary` 底，圆角 4px；聚焦时边框变 `border-accent` + 极浅 `ring-1 ring-accent-subtle`（弱强调）。
- 错误提示：`text-status-open-text`（红字，无底）；成功提示：`text-status-note-text`（绿字，无底）。
- 必填星号：`text-status-open-text`。
- 提交按钮：主按钮，提交中 `disabled:opacity-60` + 文案"提交中…"。

```tsx
<textarea className="w-full resize-y rounded-[4px] border border-divider bg-bg-secondary
                     p-space-3 text-[15px] text-text-primary outline-none
                     placeholder:text-text-tertiary
                     transition-colors duration-150 focus:border-accent focus:ring-1
                     focus:ring-accent-subtle" />
```

### 4.8 导航栏 / 页脚

- **导航栏**：`bg-bg-secondary` 纯色（不透明，删除 `backdrop-blur` 与半透明内联背景），底部 1px `border-b border-divider`。Logo 20px 主文字；导航项 15px 次级灰，hover/激活变 `text-accent`；右侧 CTA 用主按钮。
- **页脚**：顶部 1px `border-t border-divider`，内容 13px `text-text-tertiary`，居中；链接 hover 变主文字。

```tsx
<header className="sticky top-0 z-[100] border-b border-divider bg-bg-secondary">
  <div className="mx-auto flex max-w-content items-center justify-between
                  gap-space-2 px-space-3 py-space-2 sm:px-space-5 sm:py-space-3">
    {/* Logo + 导航（hover:text-accent）+ 主按钮 CTA */}
  </div>
</header>
```

---

## 5. 页面级布局示意

### 5.1 首页（总览 + 筛选 + 列表）

```
┌──────────────────────────────────────────────────────────────┐
│ 导航栏（纯色底，1px 底部分隔线；右侧墨绿主按钮 CTA）                    │
├──────────────────────────────────────────────────────────────┤
│ 大标题（Display 32px 主文字）                                    │
│ 副标题（16px 次级灰）                                            │
│ ──────────────────────────────────────────────────────────   │
│ 统计区：三列横排                                               │
│   顶部 2px 墨绿细线 │  顶部 2px 墨绿细线 │  顶部 2px 墨绿细线     │
│   Caption 标签     │  Caption 标签    │  Caption 标签          │
│   40px 大数字      │   40px 大数字     │   40px 大数字           │
│ ──────────────────────────────────────────────────────────   │
│                                                                │
│  ┌─筛选侧栏───────────┐ ┌─公告列表───────────────────────────┐  │
│  │ 地区  (caption)     │ │ 标题（16px 主文字）        [报名中] │  │
│  │ ▎全部      1,284   │ │ 地区 · 招聘 128 人 · 笔试 09-15    │  │
│  │ ▎北京市       96   │ │ [北京][事业单位][职测+综应]         │  │
│  │ ▎上海市       87   │ │ ────────────────────────────────  │  │
│  │  激活项：墨绿字+左竖线│ │ 下一条（细线分隔，无卡片）           │  │
│  │ 考试类型 (caption)   │ │ ...                              │  │
│  │ 考试科目 (caption)   │ └──────────────────────────────────┘  │
│  └──────────────────┘   （lg 起两列；移动端筛选变横向滚动条）     │
├──────────────────────────────────────────────────────────────┤
│ 页脚（1px 顶部线，13px 灰字）                                    │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 公告详情页

```
┌──────────────────────────────────────────────────────────────┐
│ 导航栏                                                        │
├──────────────────────────────────────────────────────────────┤
│ 标题区（bg-bg-secondary，无边框）                                │
│   面包屑：首页 / 公告详情（13px 灰）                             │
│   H1（Display）  + [新]（墨绿点式徽标）                          │
│   类型标签行（中性浅灰标签）                                     │
├──────────────────────────────────────────────────────────────┤
│ 信息网格（主背景）                                              │
│   ┌───────────┬───────────┐                                  │
│   │ 招聘人数   │ 笔试时间    │  ← 每格：Caption 标签 + 16px 值   │
│   │ 考试科目   │ 考试类型    │    行间 1px 分隔线                │
│   │ 地区       │ 发布日期    │    md 起两列                     │
│   │ 数据来源   │ 采集时间    │                                  │
│   └───────────┴───────────┘                                  │
│  [查看原文 · 墨绿主按钮]  [返回列表 · 次按钮]                     │
│  ─────────────────────────────────────────────────────────   │
│  纠错反馈（细线上方表单，聚焦墨绿描边）                            │
├──────────────────────────────────────────────────────────────┤
│ 页脚                                                        │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 筛选条（三种状态）

- 未激活：灰字 + 透明左竖线 + 灰计数 → hover 墨绿字。
- 激活：墨绿字 + 2px 墨绿左竖线 + 计数墨绿。
- 移动端（<lg）：整条横排 `overflow-x-auto`，各组 `min-w-[160px]` 横向滑动；激活项仍用墨绿字标识。

---

## 6. 迁移指引（旧 → 新，平滑替换）

> 目标：**组件类名几乎不动**，只改 `:root` 变量 + 少量微调。顺序执行，每步可独立验证。

### Step 1：整体替换 `:root` 变量块（frontend/app/globals.css）

把 2.1–2.4 的新变量块粘贴进 `:root`，同时用 2.5 的旧别名覆盖旧马卡龙变量。保留 `--space-*` 原值。圆角 `--radius` 由 `0px` 改为 `6px`，并新增 `--radius-sm` / `--radius-lg`。

```css
:root {
  /* 中性色 */
  --bg-primary: oklch(99% 0.003 95);
  --bg-secondary: oklch(97.2% 0.004 95);
  --text-primary: oklch(24% 0.012 275);
  --text-secondary: oklch(45% 0.01 275);
  --text-tertiary: oklch(62% 0.01 275);
  --divider: oklch(91.5% 0.005 90);

  /* 品牌强调色 */
  --accent: oklch(40% 0.07 168);
  --accent-strong: oklch(34% 0.065 168);
  --accent-subtle: oklch(94% 0.02 168);
  --accent-subtle-text: oklch(36% 0.07 168);
  --accent-contrast: oklch(99% 0 0);

  /* 状态色 */
  --status-open: oklch(55% 0.19 27);
  --status-open-subtle: oklch(95% 0.02 27);
  --status-open-text: oklch(48% 0.17 27);
  --status-closed: oklch(58% 0.01 275);
  --status-closed-subtle: oklch(94% 0.004 275);
  --status-closed-text: oklch(48% 0.01 275);
  --status-note: oklch(62% 0.13 152);
  --status-note-subtle: oklch(95% 0.02 152);
  --status-note-text: oklch(45% 0.11 152);

  /* 旧马卡龙 → 迁移别名（组件未改类名前自动退化为中性，见 2.5） */
  --accent-mint: oklch(94% 0.02 168);
  --accent-mint-text: oklch(36% 0.07 168);
  --accent-peach: oklch(95% 0.004 90);
  --accent-peach-text: oklch(40% 0.01 275);
  --accent-pink: oklch(95% 0.02 27);
  --accent-pink-text: oklch(48% 0.17 27);
  --accent-lemon: oklch(95% 0.004 90);
  --accent-lemon-text: oklch(40% 0.01 275);
  --accent-lavender: oklch(95% 0.004 90);
  --accent-lavender-text: oklch(40% 0.01 275);

  /* 间距（沿用 8pt，新增半格） */
  --space-1: 8px;
  --space-1-5: 12px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  --space-8: 64px;
  --space-10: 80px;

  /* 圆角：微圆角 */
  --radius-sm: 4px;
  --radius: 6px;
  --radius-lg: 8px;
}
```

### Step 2：tailwind.config.ts 增补映射（只加不改）

在 `colors` 中新增 `accent` / `status-*` 键与 `spacing` 的 `space-1-5`，并把 `borderRadius` 补齐 `sm`/`lg`；**不要删除**旧 `accent-mint` 等映射（Step 1 已让它们指向新值）。

```ts
colors: {
  // ...现有 bg-primary/text-primary/divider 等保留
  accent: "var(--accent)",
  "accent-strong": "var(--accent-strong)",
  "accent-subtle": "var(--accent-subtle)",
  "accent-subtle-text": "var(--accent-subtle-text)",
  "accent-contrast": "var(--accent-contrast)",
  "status-open": "var(--status-open)",
  "status-open-subtle": "var(--status-open-subtle)",
  "status-open-text": "var(--status-open-text)",
  "status-closed": "var(--status-closed)",
  "status-closed-subtle": "var(--status-closed-subtle)",
  "status-closed-text": "var(--status-closed-text)",
  "status-note": "var(--status-note)",
  "status-note-subtle": "var(--status-note-subtle)",
  "status-note-text": "var(--status-note-text)",
},
spacing: { /* ...现有 */ "space-1-5": "var(--space-1-5)" },
borderRadius: { none: "0px", sm: "var(--radius-sm)", DEFAULT: "var(--radius)", lg: "var(--radius-lg)" },
```

### Step 3：globals.css 组件层清理（删除装饰性色块）

- 删除 `.stat-item-mint/.peach/.pink/.lemon` 四个类及其 `::before` 左色条，`.stat-item:hover` 去掉 `translateX(4px)` 位移。
- `.announcement-item` 的 `::after` 分隔线保留（已符合新规范），hover 去位移/去背景，改为标题色变化即可（见 4.4）。
- 若无需全局类，可逐步把这些 `@layer components` 定义删除，样式下沉到组件 Tailwind 类。

### Step 4：组件微调清单（改动最小化）

| 文件 | 改动 |
|---|---|
| `components/Header.tsx` | 删 `backdrop-blur-sm` 与内联 `style`，改 `bg-bg-secondary border-b border-divider`；CTA 用主按钮类 |
| `components/Stats.tsx` | 删 `ACCENT_CLASSES` 与 `stat-item-*`，统一为 4.5 的统计单元 |
| `components/AnnouncementItem.tsx` | 标题 hover 色 `hover:text-accent-peach-text` → `hover:text-accent`；"新/热"徽标改墨绿点式；类型标签改中性样式（或直接依赖 Step 1 别名，零改动先跑通） |
| `components/Filter.tsx` | 激活项加 `border-l-2 border-accent text-accent`（见 4.2） |
| `app/announcement/page.tsx` | 徽标同 AnnouncementItem；"查看原文"→ 主按钮、"返回列表"→ 次按钮 |
| `components/FeedbackCenter.tsx` | 输入框 focus 描边改墨绿；提交按钮改主按钮；成功/错误提示改 `text-status-note-text` / `text-status-open-text` |
| `components/Footer.tsx` | 加 `border-t border-divider`，其余保留 |

### Step 5：旧别名清理（可选，完成组件类名统一后）

当所有组件已迁移到新语义类（`text-accent`、`status-*`、中性 tag）后，删除 2.5 的旧别名定义与 tailwind.config 中 `accent-mint` 等旧映射，完成收尾。

### 迁移验收

- [ ] 全站无马卡龙五色块（底色/文字色不再大面积使用彩底）
- [ ] 主背景近白、正文近墨、唯一强调色为墨绿
- [ ] 列表/网格仅靠 `1px divider` 分隔，无卡片阴影、无毛玻璃
- [ ] 数字全部 `tabular-nums`
- [ ] 悬停态只有颜色变化（150ms），无位移/缩放
- [ ] 移动端单列、`lg` 起两列
- [ ] 旧类名替换前页面已"中性化"（Step 1 单独生效）
