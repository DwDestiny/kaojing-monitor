import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Filter from "@/components/Filter";
import HomeClient from "@/components/HomeClient";

/** 构造 JSON 响应 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Filter 科目筛选（真实数据）", () => {
  it("渲染传入的 subjects 选项", () => {
    render(
      <Filter
        regions={[]}
        examTypes={[]}
        subjects={[{ name: "公共基础知识" }, { name: "专业知识" }]}
      />
    );
    expect(screen.getByText("公共基础知识")).toBeInTheDocument();
    expect(screen.getByText("专业知识")).toBeInTheDocument();
  });
});

describe("HomeClient 真实科目数据链路", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/subjects")) {
        return Promise.resolve(
          jsonResponse(200, {
            data: [
              { name: "公共基础知识", count: 5 },
              { name: "专业知识", count: 3 },
            ],
          })
        );
      }
      if (url.includes("/api/stats")) {
        return Promise.resolve(
          jsonResponse(200, { total: 100, byRegion: [], byExamType: [] })
        );
      }
      if (url.includes("/api/announcements")) {
        return Promise.resolve(
          jsonResponse(200, {
            data: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
          })
        );
      }
      if (url.includes("/api/regions")) {
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }
      return Promise.resolve(jsonResponse(404, { error: "not found" }));
    });
  });

  it("调用 /api/subjects 并渲染真实科目选项（不再 mock）", async () => {
    render(<HomeClient />);
    expect(
      await screen.findByText("公共基础知识")
    ).toBeInTheDocument();
    expect(screen.getByText("专业知识")).toBeInTheDocument();
    // 确认确实请求了 /api/subjects 接口
    const called = fetchMock.mock.calls.some((call) =>
      String(call[0]).includes("/api/subjects")
    );
    expect(called).toBe(true);
  });
});
