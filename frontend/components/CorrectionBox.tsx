'use client';

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { submitFeedback } from "@/lib/api";
import type { ApiResult } from "@/types";

interface CorrectionBoxProps {
  announcementId: number;
}

/** 详情页纠错备注上限 */
const MAX_LENGTH = 500;

interface Notice {
  type: "success" | "error";
  text: string;
}

export default function CorrectionBox({ announcementId }: CorrectionBoxProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function handleChange(value: string) {
    setContent(value);
    // 输入过程中清除旧的提示，避免残留误导
    setNotice(null);
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed) {
      setNotice({ type: "error", text: "请填写反馈内容" });
      return;
    }
    if (content.length > MAX_LENGTH) {
      setNotice({ type: "error", text: `备注最多 ${MAX_LENGTH} 字` });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    const result: ApiResult = await submitFeedback({
      type: "data_error",
      content: trimmed,
      announcementId,
    });
    setSubmitting(false);

    if (result.ok) {
      setNotice({ type: "success", text: "感谢反馈，我们会尽快核实处理" });
      setContent("");
    } else {
      setNotice({ type: "error", text: result.error });
    }
  }

  return (
    <div className="border-t border-divider pt-space-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-block text-[14px] font-medium text-text-secondary no-underline transition-all duration-200 ease-out hover:-translate-y-px hover:text-accent active:scale-[0.98] motion-reduce:transform-none"
        >
          发现信息有误？反馈
        </button>
      ) : (
        <div className="border border-divider p-space-4">
          <label
            htmlFor="correction-content"
            className="mb-space-2 block text-[14px] font-medium text-text-primary"
          >
            反馈内容（可附正确信息，以便我们核实修正）
          </label>
          <textarea
            id="correction-content"
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={MAX_LENGTH}
            placeholder="描述你发现的问题"
            rows={4}
            className="w-full resize-y rounded-[4px] border border-divider bg-bg-secondary p-space-3 text-[15px] text-text-primary outline-none placeholder:text-text-tertiary transition-colors duration-150 focus:border-accent focus:ring-1 focus:ring-accent-subtle"
          />
          <div className="mt-space-2 flex items-center justify-between gap-space-3">
            <span className="text-[12px] text-text-tertiary">
              {content.length}/{MAX_LENGTH}
            </span>
            <div className="flex gap-space-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setContent("");
                  setNotice(null);
                }}
                disabled={submitting}
                className="rounded-[6px] border border-divider px-space-4 py-2 text-[14px] font-medium text-text-primary transition-all duration-200 ease-out hover:-translate-y-px hover:border-text-tertiary hover:bg-bg-secondary active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-[6px] bg-accent px-space-4 py-2 text-[14px] font-medium text-accent-contrast transition-all duration-200 ease-out hover:-translate-y-px hover:bg-accent-strong active:scale-[0.98] disabled:opacity-60 motion-reduce:transform-none"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    提交中…
                  </>
                ) : (
                  "提交反馈"
                )}
              </button>
            </div>
          </div>
          {notice && (
            <p
              role="status"
              className={`mt-space-3 animate-fade-up text-[14px] motion-reduce:animate-none ${
                notice.type === "success"
                  ? "text-status-note-text"
                  : "text-status-open-text"
              }`}
            >
              {notice.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
