'use client';

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Footer from "@/components/Footer";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { fetchAnnouncementById } from "@/lib/api";
import {
  formatDateTime,
  formatExamSchedule,
  formatRecruitCount,
  formatSubjects,
} from "@/lib/format";
import type { Announcement } from "@/types";

export default function AnnouncementPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('缺少公告 ID');
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchAnnouncementById(id!);
        setAnnouncement(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="flex min-h-screen items-center justify-center px-space-5">
        <ErrorState message={error || "公告未找到"} />
      </div>
    );
  }

  const {
    title,
    url,
    region,
    recruitCount,
    examDate,
    examTime,
    examSubjects,
    examType,
    examNote,
    publishDate,
    crawledAt,
    source,
    badge,
  } = announcement;

  return (
    <>
      <div className="bg-bg-secondary px-space-5 py-space-8 max-md:px-space-3 max-md:py-space-5">
        <div className="mx-auto max-w-content">
          <nav className="mb-space-4 text-[14px] text-text-secondary" aria-label="面包屑">
            <Link href="/" className="hover:text-text-primary hover:underline">
              首页
            </Link>
            <span className="mx-2 text-text-tertiary" aria-hidden>
              /
            </span>
            <span className="text-text-primary">公告详情</span>
          </nav>

          <div className="mb-space-3 flex flex-wrap items-start gap-space-2">
            <h1 className="flex-1 text-[32px] font-bold leading-tight tracking-[-0.02em] max-md:text-[24px]">
              {title}
            </h1>
            {badge === "new" && (
              <span className="bg-accent-pink px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-accent-pink-text">
                新
              </span>
            )}
            {badge === "hot" && (
              <span className="bg-accent-peach px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-accent-peach-text">
                热
              </span>
            )}
          </div>

          <div className="mb-space-5 flex flex-wrap gap-space-1">
            {region && (
              <span className="bg-accent-mint px-3 py-1 text-[13px] font-medium text-accent-mint-text">
                {region}
              </span>
            )}
            {examType && (
              <span className="bg-accent-lemon px-3 py-1 text-[13px] font-medium text-accent-lemon-text">
                {examType}
              </span>
            )}
            {examSubjects.map((s) => (
              <span
                key={s}
                className="bg-accent-lavender px-3 py-1 text-[13px] font-medium text-accent-lavender-text"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-content px-space-5 py-space-8 max-md:px-space-3">
        <dl className="grid gap-0 bg-bg-secondary md:grid-cols-2">
          <DetailRow label="招聘人数" value={formatRecruitCount(recruitCount)} />
          <DetailRow
            label="笔试时间"
            value={formatExamSchedule(examDate, examTime, examNote)}
          />
          <DetailRow label="考试科目" value={formatSubjects(examSubjects)} />
          <DetailRow label="考试类型" value={examType ?? "待定"} />
          <DetailRow label="地区" value={region ?? "待定"} />
          <DetailRow label="发布日期" value={publishDate ?? "待定"} />
          <DetailRow label="数据来源" value={source ?? "官方网站"} />
          <DetailRow label="采集时间" value={formatDateTime(crawledAt)} />
        </dl>

        <div className="mt-space-6 flex flex-wrap gap-space-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-text-primary px-space-4 py-3 text-[15px] font-medium text-bg-secondary no-underline transition-opacity hover:opacity-[0.88]"
          >
            查看原文
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <Link
            href="/"
            className="inline-flex items-center px-space-4 py-3 text-[15px] font-medium text-text-secondary no-underline transition-colors hover:bg-bg-secondary hover:text-text-primary"
          >
            返回列表
          </Link>
        </div>
      </div>

      <Footer lastUpdate={crawledAt} />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-divider px-space-5 py-space-3">
      <dt className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
        {label}
      </dt>
      <dd className="text-[16px] font-medium text-text-primary">{value}</dd>
    </div>
  );
}
