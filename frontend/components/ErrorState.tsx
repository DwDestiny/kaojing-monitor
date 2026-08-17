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
      className="flex min-h-[200px] flex-col items-center justify-center gap-space-3 bg-bg-secondary px-space-5 py-space-8"
      role="alert"
    >
      <p className="text-[15px] text-text-secondary">{message}</p>
      <Link
        href={retryHref}
        className="bg-text-primary px-space-3 py-[10px] text-[14px] font-medium text-bg-secondary no-underline transition-opacity hover:opacity-[0.88]"
      >
        返回首页
      </Link>
    </div>
  );
}
