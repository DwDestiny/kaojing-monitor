import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSubjects,
  submitFeedback,
  verifyAdmin,
  fetchAdminFeedback,
  updateFeedbackStatus,
} from "@/lib/api";
import { MOCK_SUBJECTS } from "@/lib/mock-data";
import type {
  AdminFeedbackItem,
  ApiResult,
  SubmitFeedbackParams,
} from "@/types";

/** 构造 JSON 响应 */
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

/** 读取最近一次 fetch 调用的 [url, init] */
function lastFetchCall(): [string, RequestInit] {
  const calls = fetchMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1] as [string, RequestInit];
}

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchSubjects", () => {
  it("解析 /api/subjects 返回的 {data:[{name,count}]}", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [
          { name: "公共基础知识", count: 12 },
          { name: "专业知识", count: 3 },
        ],
      })
    );
    const subjects = await fetchSubjects();
    expect(subjects).toEqual([
      { name: "公共基础知识", count: 12 },
      { name: "专业知识", count: 3 },
    ]);
    const [url] = lastFetchCall();
    expect(url).toContain("/api/subjects");
  });

  it("开发环境请求失败时回退 MOCK_SUBJECTS", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));
    vi.stubEnv("NODE_ENV", "development");
    const subjects = await fetchSubjects();
    expect(subjects).toEqual(MOCK_SUBJECTS);
  });

  it("生产环境请求失败时抛错（不静默回退）", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));
    await expect(fetchSubjects()).rejects.toThrow("boom");
  });
});

describe("submitFeedback", () => {
  it("POST /api/feedback，body 携带 type/content/announcement_id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true }));
    const result = await submitFeedback({
      type: "data_error",
      content: "招聘人数应为 100",
      announcementId: 42,
    } satisfies SubmitFeedbackParams);
    expect(result).toEqual({ ok: true });
    const [url, init] = lastFetchCall();
    expect(url).toContain("/api/feedback");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      type: "data_error",
      content: "招聘人数应为 100",
      announcement_id: 42,
    });
  });

  it("不带 announcementId 时 body 不包含该字段", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true }));
    await submitFeedback({ type: "feature_request", content: "建议增加地区筛选" });
    const [, init] = lastFetchCall();
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("announcement_id");
  });

  it("400 返回 ok:false 且携带错误信息", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: "content 不能为空" }));
    const result = await submitFeedback({ type: "data_error", content: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("content 不能为空");
      expect(result.status).toBe(400);
    }
  });

  it("同 IP 限频 429 返回 ok:false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: "提交过于频繁" }));
    const result = await submitFeedback({ type: "data_error", content: "x" });
    expect(result).toMatchObject<ApiResult>({ ok: false, status: 429 });
    expect(result.ok).toBe(false);
  });
});

describe("verifyAdmin", () => {
  it("正确口令返回 {ok:true}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const result = await verifyAdmin("correct");
    expect(result).toEqual({ ok: true });
    const [url, init] = lastFetchCall();
    expect(url).toContain("/api/admin/verify");
    expect(JSON.parse(String(init.body))).toEqual({ password: "correct" });
  });

  it("错误口令返回 401 ok:false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "口令错误" }));
    const result = await verifyAdmin("wrong");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("口令错误");
    }
  });

  it("连续错误被锁定返回 429 ok:false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: "尝试过多，已锁定" }));
    const result = await verifyAdmin("correct");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(429);
  });
});

describe("fetchAdminFeedback", () => {
  const list: AdminFeedbackItem[] = [
    {
      id: 1,
      type: "data_error",
      content: "人数错了",
      status: "pending",
      created_at: "2026-08-20T08:00:00Z",
      announcement_id: 3,
      title: "测试公告",
    },
  ];

  it("带 x-admin-key 请求并解析 data 列表", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: list }));
    const result = await fetchAdminFeedback("key123");
    expect(result).toEqual(list);
    const [url, init] = lastFetchCall();
    expect(url).toContain("/api/admin/feedback");
    const headers = new Headers(init.headers);
    expect(headers.get("x-admin-key")).toBe("key123");
  });

  it("未授权 401 时抛错", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "未授权" }));
    await expect(fetchAdminFeedback("bad")).rejects.toThrow("未授权");
  });
});

describe("updateFeedbackStatus", () => {
  it("POST /api/admin/feedback/:id/status，携带 status 与 x-admin-key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const result = await updateFeedbackStatus(7, "resolved", "key123");
    expect(result).toEqual({ ok: true });
    const [url, init] = lastFetchCall();
    expect(url).toContain("/api/admin/feedback/7/status");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ status: "resolved" });
    const headers = new Headers(init.headers);
    expect(headers.get("x-admin-key")).toBe("key123");
  });

  it("失败时返回 ok:false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "更新失败" }));
    const result = await updateFeedbackStatus(7, "resolved", "key123");
    expect(result.ok).toBe(false);
  });
});
