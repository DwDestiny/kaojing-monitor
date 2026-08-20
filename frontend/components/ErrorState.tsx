import Link from "next/link";

interface ErrorStateProps {
  message?: string;
  retryHref?: string;
}

export default function ErrorState({
  message = "加载失败，请稍后重试",
  retryHref = "/",
}: ErrorStateProps) {
  return (
    <div
      className="flex min-h-[200px] flex-col items-center justify-center gap-space-3 border border-divider px-space-5 py-space-8"
      role="alert"
    >
      <p className="text-[15px] text-text-secondary">{message}</p>
      <Link
        href={retryHref}
        className="inline-flex items-center rounded-[6px] bg-accent px-space-4 py-2.5 text-[14px] font-medium text-accent-contrast no-underline transition-colors duration-150 hover:bg-accent-strong"
      >
        返回首页
      </Link>
    </div>
  );
}
