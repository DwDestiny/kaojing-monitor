interface LoadingStateProps {
  label?: string;
}

export default function LoadingState({
  label = "加载中…",
}: LoadingStateProps) {
  return (
    <div
      className="flex min-h-[200px] flex-col items-center justify-center gap-space-2 border border-divider px-space-5 py-space-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-8 w-8 animate-pulse border-2 border-divider border-t-accent"
        aria-hidden
      />
      <p className="text-[14px] text-text-secondary">{label}</p>
    </div>
  );
}
