import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "关于",
  description: "了解考情监测平台：自动采集全网事业单位招考公告，多维度筛选展示。",
};

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-divider bg-bg-secondary px-space-5 py-space-10 max-md:px-space-3 max-md:py-space-8">
        <div className="mx-auto max-w-content">
          <h1 className="mb-space-2 text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">
            关于考情监测
          </h1>
          <p className="max-w-[640px] text-[16px] text-text-secondary">
            事业单位招考信息自动化监测与展示平台，帮你从海量公告里快速找到目标考试。
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-content px-space-5 py-space-8 max-md:px-space-3">
        <section className="mb-space-8 pb-space-5" aria-labelledby="mission">
          <h2
            id="mission"
            className="mb-space-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary"
          >
            产品定位
          </h2>
          <ul className="space-y-space-2 text-[15px] text-text-secondary">
            <li className="flex gap-space-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              自动爬取全网招考公告，解放手动查询时间
            </li>
            <li className="flex gap-space-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              结构化展示，支持地区 / 考试类型 / 科目筛选
            </li>
            <li className="flex gap-space-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              建立考情信息资产库，持续更新
            </li>
          </ul>
        </section>

        <section
          id="help"
          className="mb-space-8 pb-space-5"
          aria-labelledby="help-title"
        >
          <h2
            id="help-title"
            className="mb-space-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary"
          >
            帮助
          </h2>
          <div className="space-y-space-3 text-[15px] text-text-secondary">
            <p>
              <strong className="font-medium text-text-primary">如何筛选公告？</strong>
              <br />
              在首页左侧选择地区、考试类型或科目，列表会自动刷新。
            </p>
            <p>
              <strong className="font-medium text-text-primary">数据多久更新？</strong>
              <br />
              爬虫按小时定时采集，页面每 60 秒可重新校验缓存。
            </p>
            <p>
              <strong className="font-medium text-text-primary">发现数据错误？</strong>
              <br />
              请通过下方「提交新网站」反馈，我们会人工审核处理。
            </p>
          </div>
        </section>

        <section
          id="submit"
          className="mb-space-8 pb-space-5"
          aria-labelledby="submit-title"
        >
          <h2
            id="submit-title"
            className="mb-space-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary"
          >
            提交新网站
          </h2>
          <p className="mb-space-4 text-[15px] text-text-secondary">
            如果你知道尚未收录的招考官网，欢迎提交。当前版本收集申请后由人工审核接入（完整表单接口将在后续版本开放）。
          </p>
          <div className="border border-divider p-space-4">
            <p className="mb-space-2 text-[14px] text-text-tertiary">
              临时反馈方式
            </p>
            <p className="text-[15px] text-text-primary">
              请准备：网站名称、URL、所属地区、简要说明。后续可在此页直接提交。
            </p>
          </div>
        </section>

        <Link
          href="/"
          className="inline-flex items-center rounded-[6px] bg-accent px-space-4 py-2.5 text-[14px] font-medium text-accent-contrast no-underline transition-colors duration-150 hover:bg-accent-strong"
        >
          返回首页查看公告
        </Link>
      </div>

      <Footer />
    </>
  );
}
