import LoadingState from "@/components/LoadingState";

export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-space-5 py-space-10">
      <LoadingState label="正在加载考情数据…" />
    </div>
  );
}
