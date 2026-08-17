import Link from "next/link";
import {
  formatExamSchedule,
  formatRecruitCount,
  formatSubjects,
} from "@/lib/format";
import type { Announcement } from "@/types";

interface AnnouncementItemProps {
  announcement: Announcement;
}

export default function AnnouncementItem({
  announcement,
}: AnnouncementItemProps) {
  const {
    id,
    title,
    region,
    recruitCount,
    examDate,
    examTime,
    examSubjects,
    examType,
    badge,
  } = announcement;

  return (
    <article className="announcement-item">
      <div className="mb-space-2 flex items-start gap-space-2">
        <Link
          href={`/announcement?id=${id}`}
          className="flex-1 text-[17px] font-medium leading-normal tracking-[-0.01em] text-text-primary no-underline transition-colors duration-200 hover:text-accent-peach-text"
        >
          {title}
        </Link>
        {badge === "new" && (
          <span
            className="whitespace-nowrap bg-accent-pink px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-accent-pink-text"
            aria-label="新公告"
          >
            新
          </span>
        )}
        {badge === "hot" && (
          <span
            className="whitespace-nowrap bg-accent-peach px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-accent-peach-text"
            aria-label="热门公告"
          >
            热
          </span>
        )}
      </div>

      <div className="mb-space-2 flex flex-wrap gap-space-4 max-md:flex-col max-md:gap-space-1">
        <div className="flex items-baseline gap-1.5 text-[14px]">
          <span className="font-normal text-text-tertiary">招聘</span>
          <span className="font-medium text-text-primary">
            {formatRecruitCount(recruitCount)}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 text-[14px]">
          <span className="font-normal text-text-tertiary">笔试</span>
          <span className="font-medium text-text-primary">
            {formatExamSchedule(examDate, examTime)}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 text-[14px]">
          <span className="font-normal text-text-tertiary">科目</span>
          <span className="font-medium text-text-primary">
            {formatSubjects(examSubjects)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-space-1" aria-label="标签">
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
        {examSubjects.map((subject) => (
          <span
            key={subject}
            className="bg-accent-lavender px-3 py-1 text-[13px] font-medium text-accent-lavender-text"
          >
            {subject.length > 4 ? subject.slice(0, 4) : subject}
          </span>
        ))}
      </div>
    </article>
  );
}
