import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "@/components/Header";
import AnnouncementItem from "@/components/AnnouncementItem";
import Stats from "@/components/Stats";
import Filter from "@/components/Filter";
import Pagination from "@/components/Pagination";
import CorrectionBox from "@/components/CorrectionBox";
import FeedbackCenter from "@/components/FeedbackCenter";
import AdminFeedbackPage from "@/components/AdminFeedbackPage";
import {
  fetchAdminFeedback,
  verifyAdmin,
} from "@/lib/api";
import type {
  AdminFeedbackItem,
  Announcement,
  Pagination as PaginationData,
  Stats as StatsData,
} from "@/types";

// 仅 mock 后台管理接口；submitFeedback 保留真实实现（走全局 fetch stub）
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchAdminFeedback: vi.fn(),
    updateFeedbackStatus: vi.fn(),
    verifyAdmin: vi.fn(),
  };
});

const verifyAdminMock = vi.mocked(verifyAdmin);
const fetchAdminFeedbackMock = vi.mocked(fetchAdminFeedback);

const announcement: Announcement = {
  id: 1,
  title: "北京市某事业单位招聘公告",
  url: "https://example.com",
  region: "北京",
  recruitCount: 128,
  examDate: "2026-09-15",
  examTime: null,
  examSubjects: ["职业能力倾向测验", "综合应用能力"],
  examType: "事业单位",
  examCategory: null,
  examNote: null,
  publishDate: "2026-08-01",
  crawledAt: "2026-08-20T08:00:00.000Z",
  source: "官方网站",
  badge: "new",
};

const stats: StatsData = {
  total: 1284,
  weeklyNew: 0,
  upcomingExams: 0,
  regionCount: 0,
  byRegion: [],
  byExamType: [],
};

const pagination: PaginationData = {
  page: 2,
  pageSize: 20,
  total: 100,
  totalPages: 5,
};

const adminItem: AdminFeedbackItem = {
  id: 1,
  type: "data_error",
  content: "招聘人数错误",
  status: "pending",
  created_at: "2026-08-20T08:00:00Z",
  announcement_id: 3,
  title: "测试公告标题",
};

/** 断言元素 className 包含指定微交互类（hover/active/动画类） */
function hasClass(el: HTMLElement, cls: string): boolean {
  return el.className.includes(cls);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("微交互：Header 导航", () => {
  it("导航项带墨绿下划线滑入类（hover 展开、reduced-motion 关闭过渡）", () => {
    render(<Header />);
    const link = screen.getByRole("link", { name: /最新公告/ });
    // 下划线由伪元素承担：初始宽度 0，hover 展开为全宽
    expect(hasClass(link, "after:absolute")).toBe(true);
    expect(hasClass(link, "after:w-0")).toBe(true);
    expect(hasClass(link, "after:bg-accent")).toBe(true);
    expect(hasClass(link, "hover:after:w-full")).toBe(true);
    expect(hasClass(link, "motion-reduce:after:transition-none")).toBe(true);
  });

  it("右侧 CTA 主按钮带按压反馈与 hover 上移类", () => {
    render(<Header />);
    const cta = screen.getByRole("link", { name: /提交新网站/ });
    expect(hasClass(cta, "active:scale-[0.98]")).toBe(true);
    expect(hasClass(cta, "hover:-translate-y-px")).toBe(true);
    expect(hasClass(cta, "transition-all")).toBe(true);
    expect(hasClass(cta, "duration-200")).toBe(true);
  });
});

describe("微交互：AnnouncementItem 列表项", () => {
  it("hover 上移 2px + 左侧墨绿竖线滑入 + 背景微变 + 点击按压反馈", () => {
    render(<AnnouncementItem announcement={announcement} />);
    const item = screen.getByText("北京市某事业单位招聘公告").closest("article");
    expect(item).not.toBeNull();
    const article = item as HTMLElement;

    expect(hasClass(article, "hover:-translate-y-[2px]")).toBe(true);
    expect(hasClass(article, "hover:bg-bg-secondary")).toBe(true);
    // 竖线：绝对定位伪元素，height 0 → 100% 滑入（不占布局、无 CLS）
    expect(hasClass(article, "before:absolute")).toBe(true);
    expect(hasClass(article, "before:h-0")).toBe(true);
    expect(hasClass(article, "before:bg-accent")).toBe(true);
    expect(hasClass(article, "hover:before:h-full")).toBe(true);
    expect(hasClass(article, "active:scale-[0.99]")).toBe(true);
    // 首屏 stagger 淡入 + reduced-motion 关闭
    expect(hasClass(article, "animate-fade-up")).toBe(true);
    expect(hasClass(article, "motion-reduce:animate-none")).toBe(true);
    expect(hasClass(article, "motion-reduce:transform-none")).toBe(true);
  });
});

describe("微交互：Stats 统计卡片", () => {
  it("hover 顶部墨绿线加粗 + 数字轻微放大 + 加载淡入", () => {
    render(<Stats stats={stats} />);
    const card = screen.getByText("总公告数").closest("article");
    expect(card).not.toBeNull();
    const article = card as HTMLElement;

    // 顶部线改为绝对定位伪元素，hover 时高度 2px → 4px（无布局偏移）
    expect(hasClass(article, "before:absolute")).toBe(true);
    expect(hasClass(article, "before:h-0.5")).toBe(true);
    expect(hasClass(article, "before:bg-accent")).toBe(true);
    expect(hasClass(article, "group-hover:before:h-1")).toBe(true);
    expect(hasClass(article, "animate-fade-up")).toBe(true);

    // 数字放大用 transform，不触发 CLS
    const number = screen.getByText("1,284");
    expect(hasClass(number, "group-hover:scale-105")).toBe(true);
    expect(hasClass(number, "transition-transform")).toBe(true);
  });
});

describe("微交互：Filter 筛选", () => {
  it("激活项带墨绿浅底背景过渡 + 点击轻微缩放", () => {
    render(
      <Filter
        regions={[{ name: "北京", count: 96 }]}
        examTypes={[]}
        subjects={[]}
        totalCount={1284}
        activeRegion="北京"
      />
    );
    const activeLink = screen.getByRole("link", { name: /北京/ });
    expect(hasClass(activeLink, "bg-accent-subtle")).toBe(true);
    expect(hasClass(activeLink, "transition-all")).toBe(true);
    expect(hasClass(activeLink, "active:scale-[0.98]")).toBe(true);

    // "全部" 在三个分组各有一个，取第一个（地区组）
    const inactiveLink = screen.getAllByRole("link", { name: /全部/ })[0];
    expect(hasClass(inactiveLink, "hover:bg-accent-subtle")).toBe(true);
  });
});

describe("微交互：Pagination 分页", () => {
  it("当前页墨绿底 + 页码 hover 过渡 + 翻页淡入", () => {
    render(<Pagination pagination={pagination} />);
    const nav = screen.getByRole("navigation", { name: /分页/ });
    expect(hasClass(nav, "animate-fade-up")).toBe(true);

    const current = screen.getByRole("link", { name: /第 2 页/ });
    expect(hasClass(current, "bg-accent")).toBe(true);
    expect(hasClass(current, "text-accent-contrast")).toBe(true);
    expect(hasClass(current, "rounded-[6px]")).toBe(true);
    expect(hasClass(current, "transition-colors")).toBe(true);
    expect(hasClass(current, "hover:bg-accent-strong")).toBe(true);
  });
});

describe("微交互：表单按钮 loading 与成功提示", () => {
  it("CorrectionBox 提交按钮：带按压类，提交中显示旋转图标，成功提示淡入", async () => {
    // 返回永不结束的 Promise，让组件停留在 submitting 态
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();
    render(<CorrectionBox announcementId={42} />);

    await user.click(screen.getByRole("button", { name: /发现信息有误/ }));
    const submitBtn = screen.getByRole("button", { name: /提交反馈/ });
    expect(hasClass(submitBtn, "active:scale-[0.98]")).toBe(true);
    expect(hasClass(submitBtn, "hover:-translate-y-px")).toBe(true);
    expect(hasClass(submitBtn, "transition-all")).toBe(true);
    expect(hasClass(submitBtn, "duration-200")).toBe(true);

    const textarea = screen.getByPlaceholderText(/描述你发现的问题/);
    await user.type(textarea, "招聘人数应为 100");
    await user.click(submitBtn);

    // 提交中：出现旋转 Loader 图标
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("CorrectionBox 成功提示带淡入动画类", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true }));
    const user = userEvent.setup();
    render(<CorrectionBox announcementId={42} />);

    await user.click(screen.getByRole("button", { name: /发现信息有误/ }));
    await user.type(
      screen.getByPlaceholderText(/描述你发现的问题/),
      "招聘人数应为 100"
    );
    await user.click(screen.getByRole("button", { name: /提交反馈/ }));

    const notice = await screen.findByText(/感谢反馈/);
    expect(hasClass(notice, "animate-fade-up")).toBe(true);
  });

  it("FeedbackCenter 提交按钮：带按压类，提交中显示旋转图标", async () => {
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();
    render(<FeedbackCenter />);

    await user.click(screen.getByRole("button", { name: /意见反馈/ }));
    await user.type(
      screen.getByPlaceholderText(/写下你的建议/),
      "建议增加排序功能"
    );
    await user.click(screen.getByRole("button", { name: /提交/ }));

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });
});

describe("微交互：AdminFeedbackPage 状态徽标", () => {
  it("状态徽标带颜色过渡类", async () => {
    sessionStorage.setItem("admin_auth", "1");
    sessionStorage.setItem("admin_key", "secret");
    fetchAdminFeedbackMock.mockResolvedValueOnce([adminItem]);

    render(<AdminFeedbackPage />);
    await screen.findByText(/测试公告标题/);

    const badge = screen.getByText("待处理");
    expect(hasClass(badge, "transition-colors")).toBe(true);
    expect(hasClass(badge, "duration-200")).toBe(true);
  });
});

describe("微交互：reduced-motion 尊重", () => {
  it("系统减少动效时动画元素仍保留 motion-reduce 关闭类", () => {
    render(<AnnouncementItem announcement={announcement} />);
    const article = screen.getByText("北京市某事业单位招聘公告").closest(
      "article"
    ) as HTMLElement;

    // 全局 globals.css 已用 @media (prefers-reduced-motion) 兜底；
    // 此处断言组件侧也显式挂载 motion-reduce 变体，双保险
    expect(hasClass(article, "motion-reduce:animate-none")).toBe(true);
    expect(hasClass(article, "motion-reduce:transition-none")).toBe(true);
  });
});

describe("微交互：现有交互不被破坏", () => {
  it("Header 导航 aria 与链接保持不变", () => {
    render(<Header />);
    expect(screen.getByRole("navigation", { name: /主导航/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /关于/ })).toBeInTheDocument();
  });

  it("AdminFeedbackPage 口令验证流程不受动画影响", async () => {
    verifyAdminMock.mockResolvedValueOnce({ ok: true });
    fetchAdminFeedbackMock.mockResolvedValueOnce([adminItem]);
    const user = userEvent.setup();

    render(<AdminFeedbackPage />);
    await user.type(screen.getByLabelText(/管理口令/), "dangwei121105");
    await user.click(screen.getByRole("button", { name: /进入/ }));

    expect(await screen.findByText(/测试公告标题/)).toBeInTheDocument();
    expect(sessionStorage.getItem("admin_auth")).toBe("1");
  });
});
