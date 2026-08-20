import Link from "next/link";

const NAV_ITEMS = [
  { href: "/#announcements", label: "最新公告" },
  { href: "/about", label: "关于" },
  { href: "/about#help", label: "帮助" },
] as const;

export default function Header() {
  return (
    <header
      className="sticky top-0 z-[100] border-b border-divider bg-bg-secondary"
      role="banner"
    >
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-space-2 px-space-3 py-space-2 sm:px-space-5 sm:py-space-3 md:flex-nowrap">
        <Link
          href="/"
          className="text-[20px] font-semibold tracking-[-0.02em] text-text-primary no-underline"
          aria-label="考情监测首页"
        >
          考情监测
        </Link>

        <nav
          className="order-3 flex w-full justify-center gap-space-3 sm:gap-space-5 md:order-none md:w-auto md:justify-start"
          aria-label="主导航"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[15px] font-medium text-text-secondary no-underline transition-colors duration-150 hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/about#submit"
          className="inline-flex items-center rounded-[6px] bg-accent px-space-3 py-2.5 text-[14px] font-medium text-accent-contrast no-underline transition-colors duration-150 hover:bg-accent-strong"
        >
          提交新网站
        </Link>
      </div>
    </header>
  );
}
