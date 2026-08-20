import Link from "next/link";
import { buildQueryString } from "@/lib/format";
import type { ExamTypeOption, Region, SubjectOption } from "@/types";

interface FilterProps {
  regions: Region[];
  examTypes: ExamTypeOption[];
  subjects: SubjectOption[];
  totalCount?: number;
  activeRegion?: string;
  activeExamType?: string;
  activeSubject?: string;
  /** 筛选数据加载失败时展示的提示信息 */
  error?: string | null;
}

interface FilterLinkProps {
  href: string;
  label: string;
  count?: number;
  active?: boolean;
}

function FilterLink({ href, label, count, active }: FilterLinkProps) {
  return (
    <li className="mb-space-1">
      <Link
        href={href}
        className={`relative flex items-center justify-between py-1.5 pr-space-1 text-[15px] no-underline transition-colors duration-150 ${
          active
            ? "border-l-2 border-accent pl-space-1 font-medium text-accent"
            : "border-l-2 border-transparent pl-space-1 font-normal text-text-secondary hover:text-accent"
        }`}
        aria-current={active ? "page" : undefined}
      >
        <span>{label}</span>
        {count != null && (
          <span
            className={`text-[13px] ${
              active ? "text-accent" : "text-text-tertiary"
            }`}
          >
            {count}
          </span>
        )}
      </Link>
    </li>
  );
}

export default function Filter({
  regions,
  examTypes,
  subjects,
  totalCount,
  activeRegion,
  activeExamType,
  activeSubject,
  error,
}: FilterProps) {
  const baseParams = {
    region: activeRegion,
    examType: activeExamType,
    subject: activeSubject,
  };

  return (
    <aside
      className="static flex gap-space-5 overflow-x-auto lg:sticky lg:top-[120px] lg:h-fit lg:block lg:overflow-visible"
      aria-label="筛选条件"
    >
      {/* 筛选数据加载失败提示 */}
      {error && (
        <div
          className="mb-space-3 min-w-[160px] border border-divider px-space-3 py-space-2 text-[13px] text-text-secondary lg:mb-space-5"
          role="alert"
        >
          筛选数据加载失败：{error}
        </div>
      )}

      {/* 地区 */}
      <div className="mb-0 min-w-[160px] lg:mb-space-5">
        <h2 className="mb-space-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
          地区
        </h2>
        <ul className="list-none p-0">
          <FilterLink
            href={`/${buildQueryString({
              examType: activeExamType,
              subject: activeSubject,
            })}`}
            label="全部"
            count={totalCount}
            active={!activeRegion}
          />
          {regions.map((region) => (
            <FilterLink
              key={region.name}
              href={`/${buildQueryString({
                ...baseParams,
                region: region.name,
                page: undefined,
              })}`}
              label={region.name}
              count={region.count}
              active={activeRegion === region.name}
            />
          ))}
        </ul>
      </div>

      {/* 考试类型 */}
      <div className="mb-0 min-w-[160px] lg:mb-space-5">
        <h2 className="mb-space-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
          考试类型
        </h2>
        <ul className="list-none p-0">
          <FilterLink
            href={`/${buildQueryString({
              region: activeRegion,
              subject: activeSubject,
            })}`}
            label="全部"
            active={!activeExamType}
          />
          {examTypes.map((type) => (
            <FilterLink
              key={type.name}
              href={`/${buildQueryString({
                region: activeRegion,
                examType: type.name,
                subject: activeSubject,
              })}`}
              label={type.name}
              count={type.count}
              active={activeExamType === type.name}
            />
          ))}
        </ul>
      </div>

      {/* 考试科目 */}
      <div className="mb-0 min-w-[160px] lg:mb-space-5">
        <h2 className="mb-space-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
          考试科目
        </h2>
        <ul className="list-none p-0">
          <FilterLink
            href={`/${buildQueryString({
              region: activeRegion,
              examType: activeExamType,
            })}`}
            label="全部"
            active={!activeSubject}
          />
          {subjects.map((subject) => (
            <FilterLink
              key={subject.name}
              href={`/${buildQueryString({
                region: activeRegion,
                examType: activeExamType,
                subject: subject.name,
              })}`}
              label={subject.name}
              count={subject.count}
              active={activeSubject === subject.name}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}
