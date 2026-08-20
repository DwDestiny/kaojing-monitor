import type { Metadata } from "next";
import Footer from "@/components/Footer";
import AdminFeedbackPage from "@/components/AdminFeedbackPage";

export const metadata: Metadata = {
  title: "反馈管理",
  description: "反馈管理后台：查看并处理用户提交的意见反馈。",
};

export default function AdminFeedbackRoute() {
  return (
    <>
      <AdminFeedbackPage />
      <Footer />
    </>
  );
}
