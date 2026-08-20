import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        divider: "var(--divider)",
        // 品牌强调色（唯一强调色：墨绿）
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-subtle": "var(--accent-subtle)",
        "accent-subtle-text": "var(--accent-subtle-text)",
        "accent-contrast": "var(--accent-contrast)",
        // 状态色
        "status-open": "var(--status-open)",
        "status-open-subtle": "var(--status-open-subtle)",
        "status-open-text": "var(--status-open-text)",
        "status-closed": "var(--status-closed)",
        "status-closed-subtle": "var(--status-closed-subtle)",
        "status-closed-text": "var(--status-closed-text)",
        "status-note": "var(--status-note)",
        "status-note-subtle": "var(--status-note-subtle)",
        "status-note-text": "var(--status-note-text)",
        // 旧马卡龙映射（迁移期保留，已指向中性/语义值）
        "accent-mint": "var(--accent-mint)",
        "accent-mint-text": "var(--accent-mint-text)",
        "accent-peach": "var(--accent-peach)",
        "accent-peach-text": "var(--accent-peach-text)",
        "accent-pink": "var(--accent-pink)",
        "accent-pink-text": "var(--accent-pink-text)",
        "accent-lemon": "var(--accent-lemon)",
        "accent-lemon-text": "var(--accent-lemon-text)",
        "accent-lavender": "var(--accent-lavender)",
        "accent-lavender-text": "var(--accent-lavender-text)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro SC",
          "PingFang SC",
          "Hiragino Sans GB",
          "Noto Sans SC",
          "Source Han Sans SC",
          "Microsoft YaHei",
          "Segoe UI",
          "sans-serif",
        ],
      },
      spacing: {
        "space-1": "var(--space-1)",
        "space-1-5": "var(--space-1-5)",
        "space-2": "var(--space-2)",
        "space-3": "var(--space-3)",
        "space-4": "var(--space-4)",
        "space-5": "var(--space-5)",
        "space-6": "var(--space-6)",
        "space-8": "var(--space-8)",
        "space-10": "var(--space-10)",
      },
      borderRadius: {
        none: "0px",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      maxWidth: {
        content: "1440px",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
