import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-content flex-col items-center justify-center px-space-5 py-space-10 text-center">
      <p className="mb-space-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
        404
      </p>
      <h1 className="mb-space-2 text-[32px] font-bold tracking-[-0.02em]">
        页面不存在
      </h1>
      <p className="mb-space-5 text-[15px] text-text-secondary">
        公告可能已下线，或链接地址有误
      </p>
      <Link
        href="/"
        className="inline-flex items-center rounded-[6px] bg-accent px-space-4 py-2.5 text-[14px] font-medium text-accent-contrast no-underline transition-colors duration-150 hover:bg-accent-strong"
      >
        返回首页
      </Link>
    </div>
  );
}
