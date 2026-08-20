'use client';

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminFeedback,
  updateFeedbackStatus,
  verifyAdmin,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AdminFeedbackItem, FeedbackType } from "@/types";

const ADMIN_AUTH_KEY = "admin_auth";
const ADMIN_KEY_KEY = "admin_key";

const TYPE_LABELS: Record<FeedbackType, string> = {
  new_website: "推荐网站",
  bug_report: "问题反馈",
  data_error: "纠错",
  feature_request: "建议",
  other: "其他",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  resolved: "已处理",
};

/** 后台反馈管理页：口令验证后展示反馈列表，支持状态流转 */
export default function AdminFeedbackPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminFeedbackItem[]>([]);

  // 会话记忆：已登录过则免重输口令
  useEffect(() => {
    const storedAuth = sessionStorage.getItem(ADMIN_AUTH_KEY);
    const storedKey = sessionStorage.getItem(ADMIN_KEY_KEY);
    if (storedAuth === "1" && storedKey) {
      setAuthenticated(true);
      setAdminKey(storedKey);
    }
  }, []);

  const loadItems = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAdminFeedback(key);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 登录态建立后拉取列表
  useEffect(() => {
    if (authenticated && adminKey) {
      loadItems(adminKey);
    }
  }, [authenticated, adminKey, loadItems]);

  async function handleVerify() {
    if (!password.trim()) return;
    setVerifying(true);
    setError(null);
    const result = await verifyAdmin(password.trim());
    setVerifying(false);

    if (result.ok) {
      sessionStorage.setItem(ADMIN_AUTH_KEY, "1");
      sessionStorage.setItem(ADMIN_KEY_KEY, password.trim());
      setAuthenticated(true);
      setAdminKey(password.trim());
    } else {
      setError(result.error);
    }
  }

  async function handleStatusChange(id: number, status: string) {
    if (!adminKey) return;
    setError(null);
    const result = await updateFeedbackStatus(id, status, adminKey);
    if (result.ok) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
    } else {
      setError(result.error);
    }
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-content px-space-5 py-space-10 max-md:px-space-3">
        <h1 className="mb-space-6 text-[24px] font-bold text-text-primary">
          反馈管理后台
        </h1>
        <div className="max-w-[360px] border border-divider p-space-5">
          <label
            htmlFor="admin-password"
            className="mb-space-2 block text-[14px] font-medium text-text-primary"
          >
            管理口令
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="请输入管理口令"
            className="w-full rounded-[4px] border border-divider bg-bg-secondary p-space-3 text-[15px] text-text-primary outline-none placeholder:text-text-tertiary transition-colors duration-150 focus:border-accent focus:ring-1 focus:ring-accent-subtle"
          />
          {error && (
            <p role="alert" className="mt-space-2 text-[14px] text-status-open-text">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="mt-space-4 w-full rounded-[6px] bg-accent px-space-4 py-3 text-[15px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-strong disabled:opacity-60"
          >
            {verifying ? "验证中…" : "进入"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-space-5 py-space-10 max-md:px-space-3">
      <div className="mb-space-6 flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-text-primary">反馈管理后台</h1>
        <span className="text-[13px] text-text-tertiary">共 {items.length} 条反馈</span>
      </div>

      {error && (
        <p role="alert" className="mb-space-4 text-[14px] text-status-open-text">
          {error}
        </p>
      )}

      {loading ? (
        <div className="px-space-5 py-space-8 text-center text-text-secondary">
          加载中…
        </div>
      ) : items.length === 0 ? (
        <div className="px-space-5 py-space-8 text-center text-text-secondary">
          暂无反馈
        </div>
      ) : (
        <ul aria-label="反馈列表">
          {items.map((item) => {
            const statusLabel = STATUS_LABELS[item.status] ?? item.status;
            return (
              <li
                key={item.id}
                className="border-b border-divider py-space-4 first:border-t first:border-divider"
              >
                <div className="mb-space-2 flex flex-wrap items-center gap-space-2">
                  <span className="rounded-[4px] border border-divider bg-bg-secondary px-2 py-0.5 text-[12px] font-medium text-text-secondary">
                    {TYPE_LABELS[item.type] ?? item.type}
                  </span>
                  <span
                    className={`rounded-[4px] px-2 py-0.5 text-[12px] font-medium ${
                      item.status === "resolved"
                        ? "bg-status-note-subtle text-status-note-text"
                        : "bg-status-open-subtle text-status-open-text"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  <span className="text-[12px] text-text-tertiary">
                    {formatDateTime(item.created_at)}
                  </span>
                </div>
                <p className="mb-1 text-[15px] text-text-primary">{item.content}</p>
                <p className="text-[13px] text-text-tertiary">
                  关联公告：{item.title ?? "（无）"}
                </p>
                {item.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(item.id, "resolved")}
                    className="mt-space-3 rounded-[6px] bg-accent px-space-3 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-strong"
                  >
                    标记已处理
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
