import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import "../login-modal.css";
import { postInquiry, fetchMyInquiries } from "../api";
import type { InquiryItem } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onToast: (msg: string, isError?: boolean) => void;
}

type Tab = "write" | "mine";

export default function InquiryModal({ isOpen, onClose, userId, onToast }: Props) {
  const [tab, setTab] = useState<Tab>("write");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // "내 문의" 탭 상태
  const [myInquiries, setMyInquiries] = useState<InquiryItem[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTab("write");
      setSubject(""); setMessage(""); setLoading(false);
      setExpandedId(null);
      requestAnimationFrame(() => {
        setMounted(true);
        setTimeout(() => textareaRef.current?.focus(), 120);
      });
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && tab === "mine" && userId) loadMyInquiries();
  }, [isOpen, tab, userId]);

  async function loadMyInquiries() {
    setMyLoading(true);
    try {
      const data = await fetchMyInquiries(userId);
      setMyInquiries(data);
    } catch (e: any) {
      onToast(e.message || "내 문의 목록을 불러오지 못했습니다.", true);
    } finally {
      setMyLoading(false);
    }
  }

  if (!isOpen) return null;

  function formatDate(iso: string) {
    if (!iso) return "";
    return iso.replace("T", " ").slice(0, 16);
  }

  async function handleSubmit() {
    if (!message.trim()) {
      onToast("문의 내용을 입력해주세요.", true);
      return;
    }
    setLoading(true);
    try {
      await postInquiry(userId || "익명", subject.trim(), message.trim());
      onToast("문의가 접수되었습니다! 빠르게 답변드리겠습니다. 📩");
      setSubject(""); setMessage("");
      if (userId) {
        setTab("mine");
      } else {
        onClose();
      }
    } catch (e: any) {
      onToast(e.message || "문의 제출에 실패했습니다.", true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`lm-backdrop${mounted ? " lm-backdrop--in" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`lm-card${mounted ? " lm-card--in" : ""}`}
        style={{ maxWidth: 480, width: "92vw" }}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        {/* 헤더 */}
        <div className="lm-header">
          <div className="lm-logo">
            <span className="lm-logo-dot" />
            <span className="lm-logo-text">문의하기</span>
          </div>
          <button className="lm-close" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 탭 */}
        <div className="lm-tabs">
          <button
            className={`lm-tab${tab === "write" ? " lm-tab--active" : ""}`}
            onClick={() => setTab("write")}
          >
            문의 작성
          </button>
          <button
            className={`lm-tab${tab === "mine" ? " lm-tab--active" : ""}`}
            onClick={() => setTab("mine")}
          >
            내 문의
          </button>
          <span
            className="lm-tab-indicator"
            style={{ transform: `translateX(${tab === "write" ? "0%" : "100%"})` }}
          />
        </div>

        {tab === "write" ? (
          <>
            <div className="lm-form" style={{ padding: "18px 20px 4px" }}>
              {/* 보내는 사람 */}
              <div className="lm-field">
                <label className="lm-label">보내는 사람</label>
                <div className="lm-input-wrap">
                  <svg className="lm-input-icon" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input
                    type="text"
                    className="lm-input"
                    value={userId || "익명"}
                    disabled
                    style={{ opacity: 0.6 }}
                  />
                </div>
                {!userId && (
                  <div className="lm-hint">
                    로그인하지 않으면 답변을 확인하기 어려워요. 로그인 후 작성을 권장해요.
                  </div>
                )}
              </div>

              {/* 제목 */}
              <div className="lm-field">
                <label className="lm-label">제목 <span style={{ opacity: 0.5, fontWeight: 500 }}>(선택)</span></label>
                <div className="lm-input-wrap">
                  <svg className="lm-input-icon" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none">
                    <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/>
                  </svg>
                  <input
                    type="text"
                    className="lm-input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="문의 제목을 입력하세요"
                    maxLength={100}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* 내용 */}
              <div className="lm-field">
                <label className="lm-label">문의 내용 <span style={{ color: "#ff8c42" }}>*</span></label>
                <textarea
                  ref={textareaRef}
                  className="lm-textarea"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="문의 내용을 자세히 작성해주세요."
                  maxLength={2000}
                  disabled={loading}
                  rows={6}
                />
                <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-secondary)", marginTop: 4, opacity: 0.6 }}>
                  {message.length} / 2000
                </div>
              </div>
            </div>

            <div className="lm-actions">
              <button className="lm-btn lm-btn--ghost" onClick={onClose} disabled={loading}>
                취소
              </button>
              <button
                className="lm-btn lm-btn--primary"
                onClick={handleSubmit}
                disabled={loading || !message.trim()}
              >
                {loading ? <span className="lm-spinner" /> : "제출"}
              </button>
            </div>
          </>
        ) : (
          <>
            {!userId ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13.5 }}>
                로그인 후 내 문의 내역을 확인할 수 있어요.
              </div>
            ) : (
              <div style={{ maxHeight: "56vh", overflowY: "auto", padding: "10px 20px 16px" }}>
                {myLoading ? (
                  <div style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)", fontSize: 13.5 }}>
                    불러오는 중…
                  </div>
                ) : myInquiries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)", fontSize: 13.5 }}>
                    아직 보낸 문의가 없습니다.
                  </div>
                ) : (
                  myInquiries.map((item) => {
                    const answered = Boolean(item.admin_reply);
                    const isExpanded = expandedId === item.id;
                    return (
                      <div
                        key={item.id}
                        style={{
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: 10,
                          padding: "11px 14px",
                          marginBottom: 9,
                          cursor: "pointer",
                        }}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                              {item.subject || "(제목 없음)"}
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
                              {formatDate(item.created_at)}
                            </div>
                          </div>
                          <span
                            className="lm-count-badge"
                            style={answered
                              ? { background: "rgba(76,175,80,0.18)", color: "#4caf50" }
                              : { background: "rgba(255,159,67,0.18)", color: "#ff9f43" }}
                          >
                            {answered ? "답변완료" : "대기중"}
                          </span>
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 8, padding: "9px 12px",
                              fontSize: 12.5, color: "var(--text-primary)",
                              lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
                            }}>
                              {item.message}
                            </div>

                            {answered && (
                              <div style={{
                                marginTop: 8,
                                background: "rgba(255,159,67,0.07)",
                                border: "1px solid rgba(255,159,67,0.22)",
                                borderRadius: 8, padding: "9px 12px",
                              }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#ff9f43", marginBottom: 4 }}>
                                  관리자 답변
                                  {item.replied_at && (
                                    <span style={{ fontWeight: 500, opacity: 0.7, marginLeft: 6 }}>
                                      {formatDate(item.replied_at)}
                                    </span>
                                  )}
                                </div>
                                <div style={{
                                  fontSize: 12.5, color: "var(--text-primary)",
                                  lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                }}>
                                  {item.admin_reply}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="lm-actions" style={{ justifyContent: "flex-end" }}>
              <button className="lm-btn lm-btn--ghost" onClick={onClose}>닫기</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}