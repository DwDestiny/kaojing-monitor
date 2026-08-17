/**
 * API 封装层
 * 浏览器走相对路径 /api/*（next rewrites 代理）
 * 服务端优先 API_BASE_URL，不可用时回退 mock
 */

import {
  MOCK_ANNOUNCEMENTS,
  MOCK_EXAM_TYPES,
  MOCK_REGIONS,
  MOCK_STATS,
  MOCK_SUBJECTS,
} from "@/lib/mock-data";
import type {
  Announcement,
  AnnouncementListResponse,
  AnnouncementQueryParams,
  ExamTypeOption,
  Region,
  Stats,
  SubjectOption,
} from "@/types";

const DEFAULT_PAGE_SIZE = 20;

/** 原始 API 行（D1 snake_case） */
interface RawAnnouncement {
  id: number;
  title: string;
  url: string;
  region: string;
  recruit_count?: number | null;
  recruitCount?: number | null;
  exam_date?: string | null;
  examDate?: string | null;
  exam_time?: string | null;
  examTime?: string | null;
  exam_subjects?: string | string[] | null;
  examSubjects?: string | string[] | null;
  exam_type?: string | null;
  examType?: string | null;
  exam_category?: string | null;
  examCategory?: string | null;
  publish_date?: string | null;
  publishDate?: string | null;
  crawled_at?: string | null;
  crawledAt?: string | null;
  source?: string | null;
}

function getApiBase(): string {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL.replace(/\/$/, "");
  }
  // 服务端直连 Workers，避免 SSR 自请求死锁
  if (typeof window === "undefined") {
    return (
      process.env.API_PROXY_TARGET || "http://127.0.0.1:8787"
    ).replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }
  // 浏览器走相对路径，由 next rewrites 代理
  return "";
}

function parseSubjects(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    // 逗号分隔或顿号分隔
  }
  return value
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function deriveBadge(
  publishDate: string | null,
  recruitCount: number | null
): "new" | "hot" | null {
  if (publishDate) {
    const published = new Date(publishDate).getTime();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    if (!Number.isNaN(published) && Date.now() - published < threeDays) {
      return "new";
    }
  }
  if (recruitCount != null && recruitCount >= 100) {
    return "hot";
  }
  return null;
}

export function normalizeAnnouncement(raw: RawAnnouncement): Announcement {
  const recruitCount = raw.recruitCount ?? raw.recruit_count ?? null;
  const publishDate = raw.publishDate ?? raw.publish_date ?? null;
  const examSubjects = parseSubjects(raw.examSubjects ?? raw.exam_subjects);

  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    region: raw.region,
    recruitCount,
    examDate: raw.examDate ?? raw.exam_date ?? null,
    examTime: raw.examTime ?? raw.exam_time ?? null,
    examSubjects,
    examType: raw.examType ?? raw.exam_type ?? null,
    examCategory: raw.examCategory ?? raw.exam_category ?? null,
    publishDate,
    crawledAt: raw.crawledAt ?? raw.crawled_at ?? null,
    source: raw.source ?? null,
    badge: deriveBadge(publishDate, recruitCount),
  };
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      let message = `请求失败 (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // ignore parse error
      }
      return { ok: false, error: message, status: res.status };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "网络错误";
    return { ok: false, error: message };
  }
}

function filterMockAnnouncements(
  params: AnnouncementQueryParams
): AnnouncementListResponse {
  let items = [...MOCK_ANNOUNCEMENTS];

  if (params.region) {
    items = items.filter((a) => a.region === params.region);
  }
  if (params.examType) {
    items = items.filter((a) => a.examType === params.examType);
  }
  if (params.examCategory) {
    items = items.filter((a) =>
      a.examSubjects.some((s) => s.includes(params.examCategory!))
    );
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);

  return {
    data,
    pagination: { page, pageSize, total, totalPages },
  };
}

/**
 * 获取公告列表
 */
export async function fetchAnnouncements(
  params: AnnouncementQueryParams = {}
): Promise<AnnouncementListResponse> {
  const search = new URLSearchParams();
  if (params.region) search.set("region", params.region);
  if (params.examType) search.set("examType", params.examType);
  if (params.examCategory) search.set("examCategory", params.examCategory);
  if (params.startDate) search.set("startDate", params.startDate);
  if (params.endDate) search.set("endDate", params.endDate);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortOrder) search.set("sortOrder", params.sortOrder);

  const qs = search.toString();
  const path = `/api/announcements${qs ? `?${qs}` : ""}`;

  const result = await apiFetch<{
    data?: RawAnnouncement[];
    pagination?: AnnouncementListResponse["pagination"];
  }>(path);

  if (!result.ok) {
    if (process.env.NODE_ENV === "development" || process.env.USE_MOCK === "1") {
      console.warn("[api] fetchAnnouncements fallback to mock:", result.error);
      return filterMockAnnouncements(params);
    }
    throw new Error(result.error);
  }

  const rawList = result.data.data ?? [];
  return {
    data: rawList.map(normalizeAnnouncement),
    pagination: result.data.pagination ?? {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
      total: rawList.length,
      totalPages: 1,
    },
  };
}

/**
 * 按 ID 获取公告详情
 */
export async function fetchAnnouncementById(
  id: string | number
): Promise<Announcement> {
  const result = await apiFetch<{ data?: RawAnnouncement; error?: string }>(
    `/api/announcements/${id}`
  );

  if (!result.ok) {
    const mock = MOCK_ANNOUNCEMENTS.find((a) => a.id === Number(id));
    if (
      mock &&
      (process.env.NODE_ENV === "development" || process.env.USE_MOCK === "1")
    ) {
      console.warn("[api] fetchAnnouncementById fallback to mock:", result.error);
      return mock;
    }
    throw new Error(result.error);
  }

  if (!result.data.data) {
    const mock = MOCK_ANNOUNCEMENTS.find((a) => a.id === Number(id));
    if (mock) return mock;
    throw new Error("Not found");
  }

  return normalizeAnnouncement(result.data.data);
}

/**
 * 获取统计数据
 */
export async function fetchStats(): Promise<Stats> {
  const result = await apiFetch<{
    total?: number;
    byRegion?: Array<{ region: string; count: number }>;
    byExamType?: Array<{ exam_type?: string; examType?: string; count: number }>;
    lastUpdate?: string | null;
    weeklyNew?: number;
    upcomingExams?: number;
    regionCount?: number;
    totalChange?: number;
    weeklyChangePercent?: number;
  }>("/api/stats");

  if (!result.ok) {
    if (process.env.NODE_ENV === "development" || process.env.USE_MOCK === "1") {
      console.warn("[api] fetchStats fallback to mock:", result.error);
      return MOCK_STATS;
    }
    throw new Error(result.error);
  }

  const d = result.data;
  const byRegion = d.byRegion ?? [];
  const byExamType = (d.byExamType ?? []).map((item) => ({
    examType: item.examType ?? item.exam_type ?? "未知",
    count: item.count,
  }));

  return {
    total: d.total ?? 0,
    weeklyNew: d.weeklyNew ?? 0,
    upcomingExams: d.upcomingExams ?? 0,
    regionCount: d.regionCount ?? byRegion.length,
    totalChange: d.totalChange,
    weeklyChangePercent: d.weeklyChangePercent,
    lastUpdate: d.lastUpdate ?? null,
    byRegion,
    byExamType,
  };
}

/**
 * 获取地区列表
 */
export async function fetchRegions(): Promise<Region[]> {
  const result = await apiFetch<{
    data?: Array<string | { name?: string; region?: string; count?: number }>;
  }>("/api/regions");

  if (!result.ok) {
    if (process.env.NODE_ENV === "development" || process.env.USE_MOCK === "1") {
      console.warn("[api] fetchRegions fallback to mock:", result.error);
      return MOCK_REGIONS;
    }
    throw new Error(result.error);
  }

  const raw = result.data.data ?? [];
  return raw.map((item) => {
    if (typeof item === "string") {
      return { name: item };
    }
    return {
      name: item.name ?? item.region ?? "未知",
      count: item.count,
    };
  });
}

/**
 * 考试类型筛选项（从 stats 或 mock）
 */
export async function fetchExamTypes(): Promise<ExamTypeOption[]> {
  try {
    const stats = await fetchStats();
    if (stats.byExamType && stats.byExamType.length > 0) {
      return stats.byExamType.map((t) => ({
        name: t.examType,
        count: t.count,
      }));
    }
  } catch {
    // fall through
  }
  return MOCK_EXAM_TYPES;
}

/**
 * 科目筛选项
 */
export async function fetchSubjects(): Promise<SubjectOption[]> {
  return MOCK_SUBJECTS;
}

export { MOCK_STATS, MOCK_EXAM_TYPES, MOCK_SUBJECTS };
