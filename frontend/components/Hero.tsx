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
    <section className="bg-bg-secondary px-space-3 py-space-8 sm:px-space-5 sm:py-space-10" aria-labelledby="hero-title">
      <div className="mx-auto max-w-content">
        <h1
          id="hero-title"
          className="mb-space-2 text-[40px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[56px]"
        >
          {lines.map((line, i) => (
            <span key={i}>
              {line}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </h1>
        <p className="max-w-[640px] text-[18px] font-normal text-text-secondary">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
