'use client';

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Footer from "@/components/Footer";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import CorrectionBox from "@/components/CorrectionBox";
import { fetchAnnouncementById } from "@/lib/api";
import {
  formatDateTime,
  formatExamSchedule,
  formatKnown,
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
    isKnown,
    complianceLevel,
  } = announcement;

  return (
    <>
      <div className="bg-bg-secondary px-space-5 py-space-8 max-md:px-space-3 max-md:py-space-5">
        <div className="mx-auto max-w-content">
          <nav className="mb-space-4 text-[14px] text-text-secondary" aria-label="面包屑">
            <Link href="/" className="transition-colors duration-150 hover:text-accent">
              首页
            </Link>
            <span className="mx-2 text-text-tertiary" aria-hidden>
              /
            </span>
            <span className="text-text-primary">公告详情</span>
          </nav>

          <div className="mb-space-3 flex flex-wrap items-start gap-space-2">
            <h1 className="flex-1 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] sm:text-[32px]">
              {title}
            </h1>
            {badge === "new" && (
              <span
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent"
                aria-label="新公告"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                新
              </span>
            )}
            {badge === "hot" && (
              <span
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent"
                aria-label="热门公告"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                热
              </span>
            )}
          </div>

          <div className="mb-space-5 flex flex-wrap gap-1.5">
            {region && (
              <span className="rounded-[4px] border border-divider bg-bg-secondary px-2 py-0.5 text-[12px] font-medium text-text-secondary">
                {region}
              </span>
            )}
            {examType && (
              <span className="rounded-[4px] border border-divider bg-bg-secondary px-2 py-0.5 text-[12px] font-medium text-text-secondary">
                {examType}
              </span>
            )}
            {examSubjects.map((s) => (
              <span
                key={s}
                className="rounded-[4px] border border-divider bg-bg-secondary px-2 py-0.5 text-[12px] font-medium text-text-secondary"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-content px-space-5 py-space-8 max-md:px-space-3">
        <dl className="grid gap-0 md:grid-cols-2">
          <DetailRow label="招聘人数" value={formatRecruitCount(recruitCount)} />
          <DetailRow
            label="笔试时间"
            value={formatExamSchedule(examDate, examTime, examNote)}
          />
          <DetailRow label="考试科目" value={formatSubjects(examSubjects)} />
          <DetailRow label="考试类型" value={formatKnown(examType, isKnown)} />
          <DetailRow label="地区" value={formatKnown(region, isKnown)} />
          <DetailRow label="发布日期" value={formatKnown(publishDate, isKnown)} />
          <DetailRow
            label="数据来源"
            value={
              complianceLevel === "restricted"
                ? `信息来源：${source ?? "官方网站"}（以官网为准）`
                : (source ?? "官方网站")
            }
          />
          <DetailRow label="采集时间" value={formatDateTime(crawledAt)} />
        </dl>

        <div className="mt-space-6 flex flex-wrap gap-space-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[6px] bg-accent px-space-4 py-2.5 text-[14px] font-medium text-accent-contrast no-underline transition-all duration-200 ease-out hover:-translate-y-px hover:bg-accent-strong active:scale-[0.98] motion-reduce:transform-none"
          >
            查看原文
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <Link
            href="/"
            className="inline-flex items-center rounded-[6px] border border-divider px-space-4 py-2.5 text-[14px] font-medium text-text-primary no-underline transition-all duration-200 ease-out hover:-translate-y-px hover:border-text-tertiary hover:bg-bg-secondary active:scale-[0.98] motion-reduce:transform-none"
          >
            返回列表
          </Link>
        </div>

        <div className="mt-space-6">
          <CorrectionBox announcementId={announcement.id} />
        </div>
      </div>

      <Footer lastUpdate={crawledAt} />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-divider px-space-3 py-space-3 transition-colors duration-150 hover:bg-bg-secondary md:px-space-5">
      <dt className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
        {label}
      </dt>
      <dd className="text-[16px] font-medium text-text-primary">{value}</dd>
    </div>
  );
}
