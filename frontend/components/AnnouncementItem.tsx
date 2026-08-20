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
    examNote,
    badge,
  } = announcement;

  return (
    <article className="announcement-item group animate-fade-up transition-all duration-200 ease-out before:absolute before:left-0 before:top-0 before:h-0 before:w-[2px] before:bg-accent before:transition-[height] before:duration-200 before:ease-out hover:-translate-y-[2px] hover:bg-bg-secondary group-hover:before:h-full active:scale-[0.99] motion-reduce:animate-none motion-reduce:transform-none motion-reduce:transition-none motion-reduce:before:transition-none">
      <div className="mb-space-2 flex items-start gap-space-2">
        <Link
          href={`/announcement?id=${id}`}
          className="flex-1 text-[16px] font-medium leading-normal tracking-[-0.01em] text-text-primary no-underline transition-colors duration-150 hover:text-accent"
        >
          {title}
        </Link>
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

      <p className="mt-space-1-5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-text-secondary">
        <span>{region}</span>
        <span aria-hidden>·</span>
        <span>招聘 {formatRecruitCount(recruitCount)} 人</span>
        <span aria-hidden>·</span>
        <span>笔试 {formatExamSchedule(examDate, examTime, examNote)}</span>
        <span aria-hidden>·</span>
        <span>科目 {formatSubjects(examSubjects)}</span>
      </p>

      <div className="mt-space-1 flex flex-wrap gap-1.5" aria-label="标签">
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
        {examSubjects.map((subject) => (
          <span
            key={subject}
            className="rounded-[4px] border border-divider bg-bg-secondary px-2 py-0.5 text-[12px] font-medium text-text-secondary"
          >
            {subject.length > 4 ? subject.slice(0, 4) : subject}
          </span>
        ))}
      </div>
    </article>
  );
}
