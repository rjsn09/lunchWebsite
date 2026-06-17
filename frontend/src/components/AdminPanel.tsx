import React, { useState, useEffect } from "react";
import { fetchInquiries, markInquiryRead, deleteInquiry } from "../api";
import type { InquiryItem } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  adminUserId: string;
  onToast: (msg: string, isError?: boolean) => void;
}

type Filter = "all" | "unread";

export default function AdminPanel({ isOpen, onClose, adminUserId, onToast }: Props) {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingIds, setPendingIds] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setMounted(true));
      loadInquiries();
    } else {
      setMounted(false);
      setInquiries([]);
      setExpandedId(null);
      setFilter("all");
    }
  }, [isOpen]);

  async function loadInquiries() {
    setLoading(true);
    try {
      const data = await fetchInquiries(adminUserId);
      setInquiries(data);
    } catch (e: any) {
      onToast(e.message || "문의 목록 로드 실패", true);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  function formatDate(iso: string) {
    if (!iso) return "";
    return iso.replace("T", " ").slice(0, 16);
  }

  function withPending<T>(id: string | number, fn: () => Promise<T>) {
    setPendingIds((prev) => new Set(prev).add(id));
    return fn().finally(() => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  async function handleToggleRead(item: InquiryItem) {
    const nextRead = !item.is_read;
    try {
      await withPending(item.id, () => markInquiryRead(item.id, adminUserId, nextRead));
      setInquiries((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_read: nextRead } : i))
      );
    } catch (e: any) {
      onToast(e.message || "상태 변경에 실패했습니다.", true);
    }
  }

  async function handleDelete(item: InquiryItem) {
    const ok = window.confirm("이 문의를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
    if (!ok) return;
    try {
      await withPending(item.id, () => deleteInquiry(item.id, adminUserId));
      setInquiries((prev) => prev.filter((i) => i.id !== item.id));
      if (expandedId === item.id) setExpandedId(null);
      onToast("문의가 삭제되었습니다.");
    } catch (e: any) {
      onToast(e.message || "삭제에 실패했습니다.", true);
    }
  }

  const unreadCount = inquiries.filter((i) => i.is_read === false).length;
  const visible = filter === "unread" ? inquiries.filter((i) => i.is_read === false) : inquiries;

  return (
    <div
      className={`lm-backdrop${mounted ? " lm-backdrop--in" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`lm-card${mounted ? " lm-card--in" : ""}`}
        style={{ maxWidth: 760, width: "95vw" }}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        {/* 헤더 */}
        <div className="lm-header">
          <div className="lm-logo">
            <span className="lm-logo-dot" style={{ background: "#e74c3c" }} />
            <span className="lm-logo-text">관리자 — 문의 목록</span>
            <span className="lm-count-badge">{inquiries.length}</span>
            {unreadCount > 0 && (
              <span className="lm-count-badge unread">미확인 {unreadCount}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={loadInquiries}
              disabled={loading}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                color: "var(--text-secondary)",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? "…" : "새로고침"}
            </button>
            <button className="lm-close" onClick={onClose} aria-label="닫기">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 필터 */}
        <div style={{ display: "flex", gap: 8, padding: "14px 20px 0" }}>
          <button
            className={`lm-filter-pill${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            전체
          </button>
          <button
            className={`lm-filter-pill${filter === "unread" ? " active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            미확인만
          </button>
        </div>

        {/* 문의 목록 */}
        <div
          style={{
            maxHeight: "62vh",
            overflowY: "auto",
            padding: "12px 20px 16px",
            marginTop: 4,
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)", fontSize: 14 }}>
              불러오는 중…
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)", fontSize: 14 }}>
              {filter === "unread" ? "미확인 문의가 없습니다." : "접수된 문의가 없습니다."}
            </div>
          ) : (
            visible.map((item) => {
              const isPending = pendingIds.has(item.id);
              const isUnread = item.is_read === false;
              const isExpanded = expandedId === item.id;

              return (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 10,
                    background: isUnread ? "rgba(231,76,60,0.05)" : "transparent",
                    transition: "background .15s",
                  }}
                >
                  {/* 요약행 */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                      cursor: "pointer",
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 0, alignItems: "flex-start" }}>
                      {isUnread && <span className="lm-unread-dot" style={{ marginTop: 5 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {item.subject || "(제목 없음)"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          <span style={{ color: "#ff8c42", fontWeight: 600 }}>{item.user_id}</span>
                          &nbsp;·&nbsp;{formatDate(item.created_at)}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {/* 펼쳐진 내용 */}
                  {isExpanded && (
                    <>
                      <div
                        style={{
                          marginTop: 10,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8,
                          padding: "10px 14px",
                          fontSize: 13,
                          color: "var(--text-primary)",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {item.message}
                      </div>

                      {/* 액션 행 */}
                      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                        <button
                          className="lm-btn lm-btn--ghost"
                          style={{ flex: "none", padding: "6px 14px", fontSize: 12 }}
                          disabled={isPending}
                          onClick={() => handleToggleRead(item)}
                        >
                          {isPending ? "…" : isUnread ? "읽음으로 표시" : "안읽음으로 표시"}
                        </button>
                        <button
                          className="lm-btn lm-btn--danger"
                          style={{ flex: "none", padding: "6px 14px", fontSize: 12 }}
                          disabled={isPending}
                          onClick={() => handleDelete(item)}
                        >
                          {isPending ? "…" : "삭제"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="lm-actions" style={{ justifyContent: "flex-end" }}>
          <button className="lm-btn lm-btn--ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}