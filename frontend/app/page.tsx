import type { Metadata } from "next";
import { Suspense } from "react";
import Hero from "@/components/Hero";
import HomeClient from "@/components/HomeClient";

export const metadata: Metadata = {
  title: "考情监测 - 事业单位招考信息自动化平台",
  description: "最新事业单位招考公告列表，支持按地区、考试类型、科目筛选。",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense
        fallback={
          <div className="mx-auto max-w-content px-space-3 py-space-10 text-center text-text-secondary">
            加载中…
          </div>
        }
      >
        <HomeClient />
      </Suspense>
    </>
  );
}
