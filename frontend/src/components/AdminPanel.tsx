import React, { useState, useEffect } from "react";
import { fetchInquiries } from "../api";
import type { InquiryItem } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  adminUserId: string;
  onToast: (msg: string, isError?: boolean) => void;
}

export default function AdminPanel({ isOpen, onClose, adminUserId, onToast }: Props) {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setMounted(true));
      loadInquiries();
    } else {
      setMounted(false);
      setInquiries([]);
      setExpandedId(null);
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

  return (
    <div
      className={`lm-backdrop${mounted ? " lm-backdrop--in" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`lm-card${mounted ? " lm-card--in" : ""}`}
        style={{ maxWidth: 560, width: "95vw" }}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        {/* 헤더 */}
        <div className="lm-header">
          <div className="lm-logo">
            <span className="lm-logo-dot" style={{ background: "#e74c3c" }} />
            <span className="lm-logo-text">관리자 — 문의 목록</span>
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

        {/* 문의 목록 */}
        <div
          style={{
            maxHeight: "60vh",
            overflowY: "auto",
            padding: "8px 20px 16px",
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)", fontSize: 14 }}>
              불러오는 중…
            </div>
          ) : inquiries.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)", fontSize: 14 }}>
              접수된 문의가 없습니다.
            </div>
          ) : (
            inquiries.map((item) => (
              <div
                key={item.id}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  paddingBottom: 12,
                  marginBottom: 12,
                }}
              >
                {/* 요약행 */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
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
                  <span style={{
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    flexShrink: 0,
                    marginTop: 2,
                  }}>
                    {expandedId === item.id ? "▲" : "▼"}
                  </span>
                </div>

                {/* 펼쳐진 내용 */}
                {expandedId === item.id && (
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
                )}
              </div>
            ))
          )}
        </div>

        <div className="lm-actions" style={{ justifyContent: "flex-end" }}>
          <button className="lm-btn lm-btn--ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}