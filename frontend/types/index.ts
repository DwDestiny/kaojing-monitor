/** 考情监测前端类型定义 */

/** 公告 */
export interface Announcement {
  id: number;
  title: string;
  url: string;
  region: string;
  recruitCount: number | null;
  examDate: string | null;
  examTime: string | null;
  examSubjects: string[];
  examType: string | null;
  examCategory: string | null;
  /** 笔试状态说明：'免笔试'=整条公告无笔试（显示"无笔试"）；null=有笔试或未标记 */
  examNote?: string | null;
  publishDate: string | null;
  crawledAt: string | null;
  source?: string | null;
  /** 展示用徽章：新 / 热 */
  badge?: "new" | "hot" | null;
}

/** 统计卡片 */
export interface Stats {
  total: number;
  weeklyNew: number;
  upcomingExams: number;
  regionCount: number;
  totalChange?: number;
  weeklyChangePercent?: number;
  lastUpdate?: string | null;
  byRegion?: RegionStat[];
  byExamType?: ExamTypeStat[];
}

export interface RegionStat {
  region: string;
  count: number;
}

export interface ExamTypeStat {
  examType: string;
  count: number;
}

/** 地区筛选项 */
export interface Region {
  name: string;
  count?: number;
}

/** 考试类型筛选项 */
export interface ExamTypeOption {
  name: string;
  count?: number;
}

/** 科目筛选项 */
export interface SubjectOption {
  name: string;
  count?: number;
}

/** 分页信息 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** 公告列表查询参数 */
export interface AnnouncementQueryParams {
  region?: string;
  examType?: string;
  examCategory?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "publish_date" | "exam_date";
  sortOrder?: "asc" | "desc";
}

/** API 列表响应 */
export interface AnnouncementListResponse {
  data: Announcement[];
  pagination: Pagination;
}

/** API 详情响应 */
export interface AnnouncementDetailResponse {
  data: Announcement;
}

/** API 地区列表响应 */
export interface RegionsResponse {
  data: string[] | Region[];
}

/** 通用 API 错误 */
export interface ApiError {
  error: string;
  status?: number;
}

/** 筛选状态 */
export interface FilterState {
  region?: string;
  examType?: string;
  subject?: string;
  page?: number;
}

/** 异步数据状态 */
export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: T };
