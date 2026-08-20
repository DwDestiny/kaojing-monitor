import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CorrectionBox from "@/components/CorrectionBox";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

function lastFetchCall(): [string, RequestInit] {
  const calls = fetchMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1] as [string, RequestInit];
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("CorrectionBox 详情页纠错反馈框", () => {
  it("默认折叠：仅显示入口按钮，不渲染输入框", () => {
    render(<CorrectionBox announcementId={42} />);
    expect(screen.getByRole("button", { name: /发现信息有误/ })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/描述你发现的问题/)).not.toBeInTheDocument();
  });

  it("点击展开输入备注并提交：body 携带 type=data_error 与 announcement_id，出现感谢提示", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true }));
    const user = userEvent.setup();
    render(<CorrectionBox announcementId={42} />);

    await user.click(screen.getByRole("button", { name: /发现信息有误/ }));
    const textarea = screen.getByPlaceholderText(/描述你发现的问题/);
    await user.type(textarea, "招聘人数应为 100");
    await user.click(screen.getByRole("button", { name: /提交反馈/ }));

    expect(await screen.findByText(/感谢反馈/)).toBeInTheDocument();

    const [url, init] = lastFetchCall();
    expect(url).toContain("/api/feedback");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      type: "data_error",
      content: "招聘人数应为 100",
      announcement_id: 42,
    });
  });

  it("输入超过 500 字被拦截，不发起请求", async () => {
    const user = userEvent.setup();
    render(<CorrectionBox announcementId={42} />);

    await user.click(screen.getByRole("button", { name: /发现信息有误/ }));
    const textarea = screen.getByPlaceholderText(/描述你发现的问题/);
    // fireEvent 绕过 maxLength，直接写入超长内容以验证组件层校验
    fireEvent.change(textarea, { target: { value: "字".repeat(501) } });
    await user.click(screen.getByRole("button", { name: /提交反馈/ }));

    expect(await screen.findByText(/最多 500 字/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("空内容提交被拦截", async () => {
    const user = userEvent.setup();
    render(<CorrectionBox announcementId={42} />);

    await user.click(screen.getByRole("button", { name: /发现信息有误/ }));
    await user.click(screen.getByRole("button", { name: /提交反馈/ }));

    expect(await screen.findByText(/请填写反馈内容/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
