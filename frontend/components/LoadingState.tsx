interface LoadingStateProps {
  label?: string;
}

export default function LoadingState({
  label = "加载中…",
}: LoadingStateProps) {
  return (
    <div
      className="flex min-h-[200px] flex-col items-center justify-center gap-space-2 bg-bg-secondary px-space-5 py-space-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-8 w-8 animate-pulse border-2 border-text-tertiary border-t-text-primary"
        aria-hidden
      />
      <p className="text-[14px] text-text-secondary">{label}</p>
    </div>
  );
}
