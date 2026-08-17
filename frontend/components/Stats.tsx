import { formatNumber } from "@/lib/format";
import type { Stats as StatsData } from "@/types";

interface StatsProps {
  stats: StatsData;
}

const ACCENT_CLASSES = [
  "stat-item-mint",
  "stat-item-peach",
  "stat-item-pink",
  "stat-item-lemon",
] as const;

export default function Stats({ stats }: StatsProps) {
  const cards = [
    {
      label: "总公告数",
      value: formatNumber(stats.total),
      change:
        stats.totalChange != null
          ? `较昨日 +${formatNumber(stats.totalChange)}`
          : "实时汇总",
    },
    {
      label: "本周新增",
      value: formatNumber(stats.weeklyNew),
      change:
        stats.weeklyChangePercent != null
          ? `环比 +${stats.weeklyChangePercent}%`
          : "近 7 天",
    },
    {
      label: "即将开考",
      value: formatNumber(stats.upcomingExams),
      change: "7 天内",
    },
    {
      label: "覆盖地区",
      value: formatNumber(stats.regionCount),
      change: "主要省市",
    },
  ];

  return (
    <section
      className="mx-auto grid max-w-content grid-cols-1 gap-space-3 px-space-3 py-space-3 sm:grid-cols-2 sm:px-space-5 sm:py-space-5 lg:grid-cols-4"
      aria-label="数据统计"
    >
      {cards.map((card, index) => (
        <article
          key={card.label}
          className={`stat-item ${ACCENT_CLASSES[index]}`}
        >
          <div className="mb-space-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
            {card.label}
          </div>
          <div className="mb-1 text-[40px] font-bold tracking-[-0.02em]">
            {card.value}
          </div>
          <div className="text-[13px] font-medium text-text-secondary">
            {card.change}
          </div>
        </article>
      ))}
    </section>
  );
}
