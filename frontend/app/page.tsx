import type { Metadata } from "next";
import AnnouncementItem from "@/components/AnnouncementItem";
import ErrorState from "@/components/ErrorState";
import Filter from "@/components/Filter";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Pagination from "@/components/Pagination";
import Stats from "@/components/Stats";
import {
  fetchAnnouncements,
  fetchExamTypes,
  fetchRegions,
  fetchStats,
  fetchSubjects,
} from "@/lib/api";
import { MOCK_STATS } from "@/lib/mock-data";
import type { Announcement, Pagination as PaginationType, Stats as StatsType } from "@/types";

export const metadata: Metadata = {
  title: "考情监测 - 事业单位招考信息自动化平台",
  description:
    "最新事业单位招考公告列表，支持按地区、考试类型、科目筛选。",
};

export const revalidate = 60;

interface HomePageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function pickParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams;
  const region = pickParam(params.region);
  const examType = pickParam(params.examType);
  const subject = pickParam(params.subject);
  const page = Math.max(1, Number(pickParam(params.page) || "1") || 1);

  let stats: StatsType = MOCK_STATS;
  let announcements: Announcement[] = [];
  let pagination: PaginationType = {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  };
  let regions: Awaited<ReturnType<typeof fetchRegions>> = [];
  let examTypes: Awaited<ReturnType<typeof fetchExamTypes>> = [];
  let subjects: Awaited<ReturnType<typeof fetchSubjects>> = [];
  let listError: string | null = null;

  try {
    const [statsRes, listRes, regionsRes, examTypesRes, subjectsRes] =
      await Promise.all([
        fetchStats().catch(() => MOCK_STATS),
        fetchAnnouncements({
          region,
          examType,
          examCategory: subject,
          page,
          pageSize: 20,
        }),
        fetchRegions().catch(() => []),
        fetchExamTypes().catch(() => []),
        fetchSubjects().catch(() => []),
      ]);

    stats = statsRes;
    announcements = listRes.data;
    pagination = listRes.pagination;
    regions = regionsRes.length
      ? regionsRes
      : (stats.byRegion ?? []).map((r) => ({
          name: r.region,
          count: r.count,
        }));
    examTypes = examTypesRes;
    subjects = subjectsRes;
  } catch (err) {
    listError = err instanceof Error ? err.message : "加载失败";
  }

  // 地区 count 优先用 stats
  if (stats.byRegion?.length) {
    const countMap = new Map(stats.byRegion.map((r) => [r.region, r.count]));
    regions = regions.map((r) => ({
      ...r,
      count: countMap.get(r.name) ?? r.count,
    }));
  }

  return (
    <>
      <Hero />
      <Stats stats={stats} />

      <div
        id="announcements"
        className="mx-auto max-w-content px-space-3 pb-space-8 sm:px-space-5 sm:pb-space-10"
      >
        <div className="mt-space-5 grid grid-cols-1 gap-space-5 lg:grid-cols-[220px_1fr] lg:gap-space-8">
          <Filter
            regions={regions}
            examTypes={examTypes}
            subjects={subjects}
            totalCount={stats.total}
            activeRegion={region}
            activeExamType={examType}
            activeSubject={subject}
          />

          <section aria-label="公告列表">
            {listError ? (
              <ErrorState message={listError} />
            ) : announcements.length === 0 ? (
              <div className="bg-bg-secondary px-space-5 py-space-8 text-center text-text-secondary">
                暂无符合条件的公告
              </div>
            ) : (
              <div className="bg-bg-secondary">
                {announcements.map((item) => (
                  <AnnouncementItem key={item.id} announcement={item} />
                ))}
                <Pagination
                  pagination={pagination}
                  region={region}
                  examType={examType}
                  subject={subject}
                />
              </div>
            )}
          </section>
        </div>
      </div>

      <Footer lastUpdate={stats.lastUpdate} />
    </>
  );
}
