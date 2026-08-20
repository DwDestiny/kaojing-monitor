import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminFeedbackPage from "@/components/AdminFeedbackPage";
import {
  fetchAdminFeedback,
  updateFeedbackStatus,
  verifyAdmin,
} from "@/lib/api";
import type { AdminFeedbackItem } from "@/types";

vi.mock("@/lib/api", () => ({
  fetchAdminFeedback: vi.fn(),
  updateFeedbackStatus: vi.fn(),
  verifyAdmin: vi.fn(),
}));

const verifyAdminMock = vi.mocked(verifyAdmin);
const fetchAdminFeedbackMock = vi.mocked(fetchAdminFeedback);
const updateFeedbackStatusMock = vi.mocked(updateFeedbackStatus);

const item: AdminFeedbackItem = {
  id: 1,
  type: "data_error",
  content: "招聘人数错误",
  status: "pending",
  created_at: "2026-08-20T08:00:00Z",
  announcement_id: 3,
  title: "测试公告标题",
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("AdminFeedbackPage admin 口令页", () => {
  it("未输入口令：仅显示口令输入框，不加载数据", () => {
    render(<AdminFeedbackPage />);
    expect(screen.getByLabelText(/管理口令/)).toBeInTheDocument();
    expect(fetchAdminFeedback).not.toHaveBeenCalled();
    expect(screen.queryByText("测试公告标题")).not.toBeInTheDocument();
  });

  it("输对口令：sessionStorage 写入记忆，加载并显示反馈列表", async () => {
    verifyAdminMock.mockResolvedValueOnce({ ok: true });
    fetchAdminFeedbackMock.mockResolvedValueOnce([item]);
    const user = userEvent.setup();

    render(<AdminFeedbackPage />);
    await user.type(screen.getByLabelText(/管理口令/), "dangwei121105");
    await user.click(screen.getByRole("button", { name: /进入/ }));

    expect(await screen.findByText(/测试公告标题/)).toBeInTheDocument();
    expect(screen.getByText("招聘人数错误")).toBeInTheDocument();
    expect(sessionStorage.getItem("admin_auth")).toBe("1");
    expect(fetchAdminFeedbackMock).toHaveBeenCalledWith("dangwei121105");
  });

  it("sessionStorage 记忆：刷新后不重输口令直接加载", async () => {
    sessionStorage.setItem("admin_auth", "1");
    sessionStorage.setItem("admin_key", "secret");
    fetchAdminFeedbackMock.mockResolvedValueOnce([item]);

    render(<AdminFeedbackPage />);
    expect(await screen.findByText(/测试公告标题/)).toBeInTheDocument();
    expect(verifyAdminMock).not.toHaveBeenCalled();
    expect(fetchAdminFeedbackMock).toHaveBeenCalledWith("secret");
  });

  it("口令错误：提示错误且不加载列表", async () => {
    verifyAdminMock.mockResolvedValueOnce({ ok: false, error: "口令错误" });
    const user = userEvent.setup();

    render(<AdminFeedbackPage />);
    await user.type(screen.getByLabelText(/管理口令/), "wrong");
    await user.click(screen.getByRole("button", { name: /进入/ }));

    expect(await screen.findByText("口令错误")).toBeInTheDocument();
    expect(fetchAdminFeedback).not.toHaveBeenCalled();
  });

  it("待处理项点击标记已处理：调用 updateFeedbackStatus 并更新状态", async () => {
    sessionStorage.setItem("admin_auth", "1");
    sessionStorage.setItem("admin_key", "secret");
    fetchAdminFeedbackMock.mockResolvedValueOnce([item]);
    updateFeedbackStatusMock.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();

    render(<AdminFeedbackPage />);
    await user.click(await screen.findByRole("button", { name: /标记已处理/ }));

    expect(updateFeedbackStatusMock).toHaveBeenCalledWith(1, "resolved", "secret");
    expect(await screen.findByText("已处理")).toBeInTheDocument();
  });
});
