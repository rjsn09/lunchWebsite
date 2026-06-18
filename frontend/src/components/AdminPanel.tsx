import React, { useState, useEffect } from "react";
// @ts-ignore
import "../login-modal.css";
import { fetchInquiries, replyToInquiry } from "../api";
import type { InquiryItem } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  adminUserId: string;
  onToast: (msg: string, isError?: boolean) => void;
}

type Filter = "all" | "unanswered";

export default function AdminPanel({ isOpen, onClose, adminUserId, onToast }: Props) {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [replyDrafts, setReplyDrafts] = useState<Record<string | number, string>>({});
  const [sendingId, setSendingId] = useState<string | number | null>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setMounted(true));
      loadInquiries();
    } else {
      setMounted(false);
      setInquiries([]);
      setExpandedId(null);
      setFilter("all");
      setReplyDrafts({});
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

  function getDraft(item: InquiryItem) {
    return replyDrafts[item.id] ?? item.admin_reply ?? "";
  }

  async function handleSendReply(item: InquiryItem) {
    const text = getDraft(item).trim();
    if (!text) {
      onToast("답변 내용을 입력해주세요.", true);
      return;
    }
    setSendingId(item.id);
    try {
      await replyToInquiry(item.id, text, adminUserId);
      setInquiries((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, admin_reply: text, replied_at: new Date().toISOString() } : i))
      );
      onToast("답변이 등록되었습니다.");
    } catch (e: any) {
      onToast(e.message || "답변 등록에 실패했습니다.", true);
    } finally {
      setSendingId(null);
    }
  }

  const unansweredCount = inquiries.filter((i) => !i.admin_reply).length;
  const visible = filter === "unanswered" ? inquiries.filter((i) => !i.admin_reply) : inquiries;

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
            {unansweredCount > 0 && (
              <span className="lm-count-badge unread">미답변 {unansweredCount}</span>
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
            className={`lm-filter-pill${filter === "unanswered" ? " active" : ""}`}
            onClick={() => setFilter("unanswered")}
          >
            미답변만
          </button>
        </div>

        {/* 문의 목록 */}
        <div style={{ maxHeight: "62vh", overflowY: "auto", padding: "12px 20px 16px", marginTop: 4 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)", fontSize: 14 }}>
              불러오는 중…
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)", fontSize: 14 }}>
              {filter === "unanswered" ? "미답변 문의가 없습니다." : "접수된 문의가 없습니다."}
            </div>
          ) : (
            visible.map((item) => {
              const isExpanded = expandedId === item.id;
              const answered = Boolean(item.admin_reply);
              const sending = sendingId === item.id;

              return (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 10,
                    background: answered ? "transparent" : "rgba(255,159,67,0.05)",
                  }}
                >
                  {/* 요약행 */}
                  <div
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 0, alignItems: "flex-start" }}>
                      {!answered && <span className="lm-unread-dot" style={{ background: "#ff9f43", boxShadow: "0 0 5px rgba(255,159,67,.6)", marginTop: 5 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 700, fontSize: 14, color: "var(--text-primary)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {item.subject || "(제목 없음)"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          <span style={{ color: "#ff8c42", fontWeight: 600 }}>{item.user_id}</span>
                          &nbsp;·&nbsp;{formatDate(item.created_at)}
                          {answered && (
                            <span style={{ marginLeft: 8, color: "#4caf50", fontWeight: 600 }}>답변완료</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", flexShrink: 0, marginTop: 2 }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {/* 펼쳐진 내용 */}
                  {isExpanded && (
                    <>
                      <div style={{
                        marginTop: 10, background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                        padding: "10px 14px", fontSize: 13, color: "var(--text-primary)",
                        lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {item.message}
                      </div>

                      {/* 답변 작성/수정 영역 */}
                      <div style={{ marginTop: 10 }}>
                        <label className="lm-label" style={{ display: "block", marginBottom: 5 }}>
                          관리자 답변
                        </label>
                        <textarea
                          className="lm-textarea"
                          rows={3}
                          value={getDraft(item)}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          placeholder="답변 내용을 입력하세요"
                          disabled={sending}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                          <button
                            className="lm-btn lm-btn--primary"
                            style={{ flex: "none", padding: "6px 16px", fontSize: 12.5 }}
                            disabled={sending}
                            onClick={() => handleSendReply(item)}
                          >
                            {sending ? "…" : answered ? "답변 수정" : "답변 보내기"}
                          </button>
                        </div>
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