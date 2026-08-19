'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AnnouncementItem from '@/components/AnnouncementItem';
import ErrorState from '@/components/ErrorState';
import Filter from '@/components/Filter';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import Stats from '@/components/Stats';
import {
  fetchAnnouncements,
  fetchExamTypes,
  fetchRegions,
  fetchStats,
  fetchSubjects,
} from '@/lib/api';
import type { Announcement, Pagination as PaginationType, Stats as StatsType } from '@/types';

export default function HomeClient() {
  const searchParams = useSearchParams();
  const region = searchParams.get('region') ?? undefined;
  const examType = searchParams.get('examType') ?? undefined;
  const subject = searchParams.get('subject') ?? undefined;
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);

  const [loading, setLoading] = useState(true);
  // stats 初始为 null：不再用 MOCK_STATS 兜底，加载成功后填充真实数据
  const [stats, setStats] = useState<StatsType | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1, pageSize: 20, total: 0, totalPages: 1,
  });
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([]);
  const [examTypes, setExamTypes] = useState<Awaited<ReturnType<typeof fetchExamTypes>>>([]);
  const [subjects, setSubjects] = useState<Awaited<ReturnType<typeof fetchSubjects>>>([]);
  const [listError, setListError] = useState<string | null>(null);
  // 各数据源独立错误态：失败时展示错误提示而非静默吞错
  const [statsError, setStatsError] = useState<string | null>(null);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [examTypesError, setExamTypesError] = useState<string | null>(null);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setListError(null);
    setStatsError(null);
    setRegionsError(null);
    setExamTypesError(null);
    setSubjectsError(null);

    const errorMessage = (err: unknown) =>
      err instanceof Error ? err.message : '加载失败';

    Promise.all([
      // 各数据源独立处理：失败仅记录对应 error state，不阻断其他数据加载
      fetchStats().catch((err) => {
        setStatsError(errorMessage(err));
        return null;
      }),
      fetchAnnouncements({ region, examType, examCategory: subject, page, pageSize: 20 }),
      fetchRegions().catch((err) => {
        setRegionsError(errorMessage(err));
        return [];
      }),
      fetchExamTypes().catch((err) => {
        setExamTypesError(errorMessage(err));
        return [];
      }),
      fetchSubjects().catch((err) => {
        setSubjectsError(errorMessage(err));
        return [];
      }),
    ])
      .then(([statsRes, listRes, regionsRes, examTypesRes, subjectsRes]) => {
        setStats(statsRes);
        setAnnouncements(listRes.data);
        setPagination(listRes.pagination);

        // stats 失败时 statsRes 为 null，跳过地区计数补充
        const statsByRegion = statsRes?.byRegion ?? [];

        let finalRegions = regionsRes.length
          ? regionsRes
          : statsByRegion.map((r) => ({ name: r.region, count: r.count }));

        if (statsByRegion.length) {
          const countMap = new Map(statsByRegion.map((r) => [r.region, r.count]));
          finalRegions = finalRegions.map((r) => ({
            ...r,
            count: countMap.get(r.name) ?? r.count,
          }));
        }

        setRegions(finalRegions);
        setExamTypes(examTypesRes);
        setSubjects(subjectsRes);
      })
      .catch((err) => {
        setListError(errorMessage(err));
      })

      .finally(() => {
        setLoading(false);
        
        // 筛选完成后滚动到列表顶部
        setTimeout(() => {
          const listElement = document.getElementById('announcements');
          if (listElement) {
            const offset = 80; // 顶部导航栏高度
            const elementTop = listElement.getBoundingClientRect().top;
            const scrollTop = window.scrollY || window.pageYOffset;
            
            // 只在当前位置高于列表时才滚动
            if (scrollTop > listElement.offsetTop - offset) {
              window.scrollTo({
                top: listElement.offsetTop - offset,
                behavior: 'smooth'
              });
            }
          }
        }, 100);
      });
  }, [region, examType, subject, page]);

  return (
    <>
      {statsError ? (
        <ErrorState message={statsError} />
      ) : stats ? (
        <Stats stats={stats} />
      ) : null}
      <div
        id="announcements"
        className="mx-auto max-w-content px-space-3 pb-space-8 sm:px-space-5 sm:pb-space-10"
      >
        <div className="mt-space-5 grid grid-cols-1 gap-space-5 lg:grid-cols-[220px_1fr] lg:gap-space-8">
          <Filter
            regions={regions}
            examTypes={examTypes}
            subjects={subjects}
            totalCount={stats?.total}
            activeRegion={region}
            activeExamType={examType}
            activeSubject={subject}
            error={regionsError ?? examTypesError ?? subjectsError}
          />
          <section aria-label="公告列表">
            {loading ? (
              <div className="bg-bg-secondary px-space-5 py-space-8 text-center text-text-secondary">
                加载中…
              </div>
            ) : listError ? (
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
      <Footer lastUpdate={stats?.lastUpdate ?? null} />
    </>
  );
}
