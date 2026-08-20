import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import type { ReactNode } from 'react';

// next/link：jsdom 中渲染为普通 <a>，便于断言链接/入口行为
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string };
    children: ReactNode;
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}));

// next/navigation：测试中提供稳定的查询串与路由方法
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
