import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "考情监测 - 事业单位招考信息自动化平台",
    template: "%s · 考情监测",
  },
  description:
    "全网事业单位招考公告自动采集与多维度筛选，不错过任何考试机会。",
  keywords: [
    "事业单位",
    "招考公告",
    "三支一扶",
    "教师招聘",
    "考情监测",
  ],
  openGraph: {
    title: "考情监测 - 事业单位招考信息自动化平台",
    description: "全网公告自动采集，多维度筛选，不错过任何考试机会",
    locale: "zh_CN",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Header />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
