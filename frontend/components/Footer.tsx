import Link from "next/link";
import { formatDateTime } from "@/lib/format";

interface FooterProps {
  lastUpdate?: string | null;
}

export default function Footer({ lastUpdate }: FooterProps) {
  const year = new Date().getFullYear();
  const updated = lastUpdate ? formatDateTime(lastUpdate) : "—";

  return (
    <footer
      className="mt-space-10 border-t border-divider px-space-5 py-space-5"
      role="contentinfo"
    >
      <div className="mx-auto max-w-content text-center text-[13px] text-text-tertiary">
        <p className="mb-1">
          © {year} 考情监测 · 数据每小时自动更新
        </p>
        <p className="mb-1">
          最后更新：{updated} ·{" "}
          <Link
            href="/about#submit"
            className="font-medium text-text-secondary no-underline transition-colors duration-150 hover:text-text-primary"
          >
            提交新网站
          </Link>
        </p>
        <p className="mx-auto mt-space-3 max-w-2xl leading-relaxed text-text-tertiary/80">
          本平台仅对各地政府及官方机构公开发布的招考信息进行结构化聚合与展示，所有公告信息版权归原发布单位所有，
          以官方发布为准。本平台不转载、不存储公告原文全文，仅展示事实性字段并提供原文链接。
        </p>
      </div>
    </footer>
  );
}
