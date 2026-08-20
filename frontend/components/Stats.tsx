import { formatNumber } from "@/lib/format";
import type { Stats as StatsData } from "@/types";

interface StatsProps {
  stats: StatsData;
}

export default function Stats({ stats }: StatsProps) {
  // 只展示 /api/stats 真实返回的字段：
  // total / byRegion / byExamType（weeklyNew/upcomingExams/totalChange 后端不返回，已移除）
  const cards = [
    {
      label: "总公告数",
      value: formatNumber(stats.total),
      change: "实时汇总",
    },
    {
      label: "覆盖地区",
      value: formatNumber(stats.byRegion?.length ?? 0),
      change: "主要省市",
    },
    {
      label: "考试类型",
      value: formatNumber(stats.byExamType?.length ?? 0),
      change: "分类统计",
    },
  ];

  return (
    <section
      className="mx-auto grid max-w-content grid-cols-1 gap-x-space-3 px-space-3 py-space-3 sm:grid-cols-2 sm:px-space-5 sm:py-space-5 lg:grid-cols-3"
      aria-label="数据统计"
    >
      {cards.map((card) => (
        <article
          key={card.label}
          className="border-b border-divider pb-space-3 pt-space-3 lg:border-b-0"
        >
          <div className="border-t-2 border-accent pt-space-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
            {card.label}
          </div>
          <div className="mt-space-1 text-[40px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums text-text-primary">
            {card.value}
          </div>
          <div className="mt-space-1 text-[13px] text-text-secondary">
            {card.change}
          </div>
        </article>
      ))}
    </section>
  );
}
