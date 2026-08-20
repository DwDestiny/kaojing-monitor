import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FeedbackCenter from "@/components/FeedbackCenter";

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

describe("FeedbackCenter 全站反馈中心", () => {
  it("点击入口打开弹窗，默认显示提建议 Tab", async () => {
    const user = userEvent.setup();
    render(<FeedbackCenter />);
    await user.click(screen.getByRole("button", { name: /意见反馈/ }));

    expect(screen.getByRole("tab", { name: /提建议/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /推荐网站/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/写下你的建议/)).toBeInTheDocument();
  });

  it("切换至推荐网站 Tab，显示名称/网址/说明字段", async () => {
    const user = userEvent.setup();
    render(<FeedbackCenter />);
    await user.click(screen.getByRole("button", { name: /意见反馈/ }));

    await user.click(screen.getByRole("tab", { name: /推荐网站/ }));
    expect(screen.getByPlaceholderText(/网站名称/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/https:\/\//)).toBeInTheDocument();
  });

  it("提建议提交 feature_request", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true }));
    const user = userEvent.setup();
    render(<FeedbackCenter />);
    await user.click(screen.getByRole("button", { name: /意见反馈/ }));

    await user.type(
      screen.getByPlaceholderText(/写下你的建议/),
      "建议增加按公告发布时间排序"
    );
    await user.click(screen.getByRole("button", { name: /提交/ }));

    expect(await screen.findByText(/感谢反馈/)).toBeInTheDocument();
    const [url, init] = lastFetchCall();
    expect(url).toContain("/api/feedback");
    expect(JSON.parse(String(init.body))).toEqual({
      type: "feature_request",
      content: "建议增加按公告发布时间排序",
    });
  });

  it("推荐网站提交 new_website，content 拼接名称与地址", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true }));
    const user = userEvent.setup();
    render(<FeedbackCenter />);
    await user.click(screen.getByRole("button", { name: /意见反馈/ }));
    await user.click(screen.getByRole("tab", { name: /推荐网站/ }));

    await user.type(screen.getByPlaceholderText(/网站名称/), "某市人事考试网");
    await user.type(
      screen.getByPlaceholderText(/https:\/\//),
      "https://example.com/rsks"
    );
    await user.type(screen.getByPlaceholderText(/补充说明/), "官方招考信息源");
    await user.click(screen.getByRole("button", { name: /提交/ }));

    expect(await screen.findByText(/感谢反馈/)).toBeInTheDocument();
    const [url, init] = lastFetchCall();
    expect(url).toContain("/api/feedback");
    const body = JSON.parse(String(init.body)) as {
      type: string;
      content: string;
    };
    expect(body.type).toBe("new_website");
    expect(body.content).toContain("名称: 某市人事考试网");
    expect(body.content).toContain("地址: https://example.com/rsks");
    expect(body.content).toContain("说明: 官方招考信息源");
  });

  it("推荐网站缺少名称或网址被拦截", async () => {
    const user = userEvent.setup();
    render(<FeedbackCenter />);
    await user.click(screen.getByRole("button", { name: /意见反馈/ }));
    await user.click(screen.getByRole("tab", { name: /推荐网站/ }));

    await user.type(
      screen.getByPlaceholderText(/https:\/\//),
      "https://example.com"
    );
    await user.click(screen.getByRole("button", { name: /提交/ }));

    expect(await screen.findByText(/请填写网站名称/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defaultTab=new_website 时打开即显示推荐网站字段", async () => {
    const user = userEvent.setup();
    render(<FeedbackCenter defaultTab="new_website" />);
    await user.click(screen.getByRole("button", { name: /意见反馈/ }));

    expect(screen.getByPlaceholderText(/网站名称/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/https:\/\//)).toBeInTheDocument();
  });
});
