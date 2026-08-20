interface HeroProps {
  title?: string;
  subtitle?: string;
}

export default function Hero({
  title = "事业单位招考信息\n自动化监测",
  subtitle = "全网公告自动采集，多维度筛选，不错过任何考试机会",
}: HeroProps) {
  const lines = title.split("\n");

  return (
    <section
      className="border-b border-divider bg-bg-secondary px-space-3 py-space-8 sm:px-space-5 sm:py-space-10"
      aria-labelledby="hero-title"
    >
      <div className="mx-auto max-w-content">
        <h1
          id="hero-title"
          className="mb-space-2 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] sm:text-[32px]"
        >
          {lines.map((line, i) => (
            <span key={i}>
              {line}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </h1>
        <p className="max-w-[640px] text-[16px] font-normal text-text-secondary">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
