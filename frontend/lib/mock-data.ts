import type {
  Announcement,
  ExamTypeOption,
  Region,
  Stats,
  SubjectOption,
} from "@/types";

/** 本地开发 mock 数据（API 不可用时回退） */

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title:
      '新疆生产建设兵团第五师双河市2026年高校毕业生"三支一扶"计划招募公告',
    url: "https://example.com/announcements/1",
    region: "新疆",
    recruitCount: 49,
    examDate: "2026-07-12",
    examTime: "10:00-12:30",
    examSubjects: ["职测", "综合应用能力"],
    examType: "三支一扶",
    examCategory: null,
    publishDate: "2026-06-29",
    crawledAt: "2026-08-17T06:30:00Z",
    badge: "new",
  },
  {
    id: 2,
    title: '新疆生产建设兵团第九师白杨市2026年"三支一扶"计划人员招募公告',
    url: "https://example.com/announcements/2",
    region: "新疆",
    recruitCount: 71,
    examDate: "2026-07-12",
    examTime: "10:00-12:30",
    examSubjects: ["职测", "综合应用能力"],
    examType: "三支一扶",
    examCategory: null,
    publishDate: "2026-06-28",
    crawledAt: "2026-08-17T06:30:00Z",
    badge: "hot",
  },
  {
    id: 3,
    title: "北京市朝阳区2026年事业单位公开招聘工作人员公告",
    url: "https://example.com/announcements/3",
    region: "北京",
    recruitCount: 135,
    examDate: "2026-07-18",
    examTime: "09:00-11:30",
    examSubjects: ["公基", "职测"],
    examType: "事业单位",
    examCategory: null,
    publishDate: "2026-06-25",
    crawledAt: "2026-08-16T10:00:00Z",
  },
  {
    id: 4,
    title: "上海市浦东新区教育系统2026年第二批教师招聘公告",
    url: "https://example.com/announcements/4",
    region: "上海",
    recruitCount: 268,
    examDate: "2026-07-20",
    examTime: "13:30-15:30",
    examSubjects: ["教育综合", "专业知识"],
    examType: "教师招聘",
    examCategory: null,
    publishDate: "2026-06-24",
    crawledAt: "2026-08-16T10:00:00Z",
  },
  {
    id: 5,
    title: "广东省广州市天河区2026年事业单位集中公开招聘工作人员公告",
    url: "https://example.com/announcements/5",
    region: "广东",
    recruitCount: 89,
    examDate: "2026-07-25",
    examTime: "09:00-11:00",
    examSubjects: ["公基", "职测", "专业知识"],
    examType: "事业单位",
    examCategory: null,
    publishDate: "2026-06-22",
    crawledAt: "2026-08-15T12:00:00Z",
  },
  {
    id: 6,
    title: "四川省成都市金牛区2026年事业单位公开招聘公告",
    url: "https://example.com/announcements/6",
    region: "四川",
    recruitCount: 112,
    examDate: "2026-07-28",
    examTime: "14:00-16:00",
    examSubjects: ["综合知识"],
    examType: "事业单位",
    examCategory: null,
    publishDate: "2026-06-20",
    crawledAt: "2026-08-15T12:00:00Z",
  },
];

export const MOCK_STATS: Stats = {
  total: 1243,
  weeklyNew: 68,
  upcomingExams: 23,
  regionCount: 32,
  totalChange: 18,
  weeklyChangePercent: 12,
  lastUpdate: "2026-08-17T06:30:00Z",
  byRegion: [
    { region: "新疆", count: 156 },
    { region: "广东", count: 124 },
    { region: "四川", count: 98 },
    { region: "北京", count: 89 },
    { region: "上海", count: 67 },
  ],
  byExamType: [
    { examType: "事业单位", count: 567 },
    { examType: "教师招聘", count: 442 },
    { examType: "三支一扶", count: 234 },
  ],
};

export const MOCK_REGIONS: Region[] = [
  { name: "新疆", count: 156 },
  { name: "北京", count: 89 },
  { name: "上海", count: 67 },
  { name: "广东", count: 124 },
  { name: "四川", count: 98 },
];

export const MOCK_EXAM_TYPES: ExamTypeOption[] = [
  { name: "三支一扶", count: 234 },
  { name: "事业单位", count: 567 },
  { name: "教师招聘", count: 442 },
];

export const MOCK_SUBJECTS: SubjectOption[] = [
  { name: "职测" },
  { name: "公基" },
  { name: "综合" },
];
