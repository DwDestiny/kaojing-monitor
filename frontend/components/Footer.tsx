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
      className="mt-space-10 bg-bg-secondary px-space-5 py-space-5"
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
            className="font-medium text-text-primary no-underline hover:underline"
          >
            提交新网站
          </Link>
        </p>
      </div>
    </footer>
  );
}
