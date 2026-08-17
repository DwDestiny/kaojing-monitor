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
import { MOCK_STATS } from '@/lib/mock-data';
import type { Announcement, Pagination as PaginationType, Stats as StatsType } from '@/types';

export default function HomeClient() {
  const searchParams = useSearchParams();
  const region = searchParams.get('region') ?? undefined;
  const examType = searchParams.get('examType') ?? undefined;
  const subject = searchParams.get('subject') ?? undefined;
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsType>(MOCK_STATS);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1, pageSize: 20, total: 0, totalPages: 1,
  });
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof fetchRegions>>>([]);
  const [examTypes, setExamTypes] = useState<Awaited<ReturnType<typeof fetchExamTypes>>>([]);
  const [subjects, setSubjects] = useState<Awaited<ReturnType<typeof fetchSubjects>>>([]);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setListError(null);

    Promise.all([
      fetchStats().catch(() => MOCK_STATS),
      fetchAnnouncements({ region, examType, examCategory: subject, page, pageSize: 20 }),
      fetchRegions().catch(() => []),
      fetchExamTypes().catch(() => []),
      fetchSubjects().catch(() => []),
    ])
      .then(([statsRes, listRes, regionsRes, examTypesRes, subjectsRes]) => {
        setStats(statsRes);
        setAnnouncements(listRes.data);
        setPagination(listRes.pagination);

        let finalRegions = regionsRes.length
          ? regionsRes
          : (statsRes.byRegion ?? []).map((r) => ({ name: r.region, count: r.count }));

        if (statsRes.byRegion?.length) {
          const countMap = new Map(statsRes.byRegion.map((r) => [r.region, r.count]));
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
        setListError(err instanceof Error ? err.message : '加载失败');
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
      <Footer lastUpdate={stats.lastUpdate} />
    </>
  );
}
