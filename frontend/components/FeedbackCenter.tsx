'use client';

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { submitFeedback } from "@/lib/api";
import type { SubmitFeedbackParams } from "@/types";

export type FeedbackTab = "suggestion" | "new_website";

interface FeedbackCenterProps {
  /** 打开弹窗时激活的 Tab */
  defaultTab?: FeedbackTab;
  /** 触发按钮文案 */
  triggerLabel?: string;
  /** 触发按钮附加样式（供页头/页脚等不同场景复用） */
  triggerClassName?: string;
}

/** 提建议内容上限 */
const MAX_SUGGESTION_LENGTH = 2000;

interface Notice {
  type: "success" | "error";
  text: string;
}

const TABS: Array<{ id: FeedbackTab; label: string }> = [
  { id: "suggestion", label: "提建议" },
  { id: "new_website", label: "推荐网站" },
];

export default function FeedbackCenter({
  defaultTab = "suggestion",
  triggerLabel = "意见反馈",
  triggerClassName = "",
}: FeedbackCenterProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<FeedbackTab>(defaultTab);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // 提建议 Tab
  const [suggestion, setSuggestion] = useState("");
  // 推荐网站 Tab
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteNote, setSiteNote] = useState("");

  function openDialog() {
    setTab(defaultTab);
    setNotice(null);
    setOpen(true);
  }

  function closeDialog() {
    if (submitting) return;
    setOpen(false);
    setNotice(null);
  }

  function resetForm() {
    setSuggestion("");
    setSiteName("");
    setSiteUrl("");
    setSiteNote("");
  }

  async function handleSubmit() {
    let params: SubmitFeedbackParams;

    if (tab === "suggestion") {
      const trimmed = suggestion.trim();
      if (!trimmed) {
        setNotice({ type: "error", text: "请填写建议内容" });
        return;
      }
      if (suggestion.length > MAX_SUGGESTION_LENGTH) {
        setNotice({
          type: "error",
          text: `建议最多 ${MAX_SUGGESTION_LENGTH} 字`,
        });
        return;
      }
      params = { type: "feature_request", content: trimmed };
    } else {
      const name = siteName.trim();
      const url = siteUrl.trim();
      if (!name) {
        setNotice({ type: "error", text: "请填写网站名称" });
        return;
      }
      if (!url) {
        setNotice({ type: "error", text: "请填写网站网址" });
        return;
      }
      params = {
        type: "new_website",
        content: `名称: ${name}\n地址: ${url}\n说明: ${siteNote.trim()}`,
      };
    }

    setSubmitting(true);
    setNotice(null);
    const result = await submitFeedback(params);
    setSubmitting(false);

    if (result.ok) {
      resetForm();
      setNotice({ type: "success", text: "感谢反馈，我们会尽快处理" });
    } else {
      setNotice({ type: "error", text: result.error });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={`inline-block no-underline transition-all duration-200 ease-out hover:-translate-y-px hover:text-accent active:scale-[0.98] motion-reduce:transform-none ${triggerClassName}`}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-primary/70 p-space-3"
          role="dialog"
          aria-modal="true"
          aria-label="意见反馈"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-[560px] rounded-lg border border-divider bg-bg-primary p-space-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-space-4 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-text-primary">
                意见反馈
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="关闭"
                className="text-text-tertiary transition-colors hover:text-text-primary"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Tab 切换 */}
            <div
              role="tablist"
              aria-label="反馈类型"
              className="mb-space-4 flex gap-space-1 border-b border-divider"
            >
              {TABS.map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => {
                    setTab(item.id);
                    setNotice(null);
                  }}
                  className={`px-space-3 py-2 text-[14px] font-medium transition-colors duration-150 ${
                    tab === item.id
                      ? "border-b-2 border-accent text-accent"
                      : "border-b-2 border-transparent text-text-secondary hover:text-accent"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "suggestion" ? (
              <div>
                <label
                  htmlFor="feedback-suggestion"
                  className="mb-space-2 block text-[14px] font-medium text-text-primary"
                >
                  你的建议
                </label>
                <textarea
                  id="feedback-suggestion"
                  value={suggestion}
                  onChange={(e) => {
                    setSuggestion(e.target.value);
                    setNotice(null);
                  }}
                  maxLength={MAX_SUGGESTION_LENGTH}
                  placeholder="写下你的建议"
                  rows={5}
                  className="w-full resize-y rounded-[4px] border border-divider bg-bg-secondary p-space-3 text-[15px] text-text-primary outline-none placeholder:text-text-tertiary transition-colors duration-150 focus:border-accent focus:ring-1 focus:ring-accent-subtle"
                />
                <div className="mt-space-2 text-right text-[12px] text-text-tertiary">
                  {suggestion.length}/{MAX_SUGGESTION_LENGTH}
                </div>
              </div>
            ) : (
              <div className="space-y-space-3">
                <div>
                  <label
                    htmlFor="feedback-site-name"
                    className="mb-space-2 block text-[14px] font-medium text-text-primary"
                  >
                    网站名称 <span className="text-status-open-text">*</span>
                  </label>
                  <input
                    id="feedback-site-name"
                    value={siteName}
                    onChange={(e) => {
                      setSiteName(e.target.value);
                      setNotice(null);
                    }}
                    placeholder="网站名称"
                    className="w-full rounded-[4px] border border-divider bg-bg-secondary p-space-3 text-[15px] text-text-primary outline-none placeholder:text-text-tertiary transition-colors duration-150 focus:border-accent focus:ring-1 focus:ring-accent-subtle"
                  />
                </div>
                <div>
                  <label
                    htmlFor="feedback-site-url"
                    className="mb-space-2 block text-[14px] font-medium text-text-primary"
                  >
                    网址 <span className="text-status-open-text">*</span>
                  </label>
                  <input
                    id="feedback-site-url"
                    value={siteUrl}
                    onChange={(e) => {
                      setSiteUrl(e.target.value);
                      setNotice(null);
                    }}
                    placeholder="https://"
                    className="w-full rounded-[4px] border border-divider bg-bg-secondary p-space-3 text-[15px] text-text-primary outline-none placeholder:text-text-tertiary transition-colors duration-150 focus:border-accent focus:ring-1 focus:ring-accent-subtle"
                  />
                </div>
                <div>
                  <label
                    htmlFor="feedback-site-note"
                    className="mb-space-2 block text-[14px] font-medium text-text-primary"
                  >
                    补充说明
                  </label>
                  <textarea
                    id="feedback-site-note"
                    value={siteNote}
                    onChange={(e) => {
                      setSiteNote(e.target.value);
                      setNotice(null);
                    }}
                    placeholder="补充说明"
                    rows={3}
                    className="w-full resize-y rounded-[4px] border border-divider bg-bg-secondary p-space-3 text-[15px] text-text-primary outline-none placeholder:text-text-tertiary transition-colors duration-150 focus:border-accent focus:ring-1 focus:ring-accent-subtle"
                  />
                </div>
              </div>
            )}

            <div className="mt-space-4 flex items-center justify-between gap-space-3">
              <div className="min-h-[20px]">
                {notice && (
                  <p
                    role="status"
                    className={`animate-fade-up text-[14px] motion-reduce:animate-none ${
                      notice.type === "success"
                        ? "text-status-note-text"
                        : "text-status-open-text"
                    }`}
                  >
                    {notice.text}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-[6px] bg-accent px-space-5 py-3 text-[15px] font-medium text-accent-contrast transition-all duration-200 ease-out hover:-translate-y-px hover:bg-accent-strong active:scale-[0.98] disabled:opacity-60 motion-reduce:transform-none"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    提交中…
                  </>
                ) : (
                  "提交"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
