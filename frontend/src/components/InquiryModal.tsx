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

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function InquiryModal({ isOpen, onClose, userId, onToast }: Props) {
  const [tab, setTab]       = useState<Tab>("write");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [myInquiries, setMyInquiries] = useState<InquiryItem[]>([]);
  const [myLoading, setMyLoading]     = useState(false);
  const [expandedId, setExpandedId]   = useState<string | number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTab("write"); setSubject(""); setMessage(""); setLoading(false);
      setExpandedId(null);
      requestAnimationFrame(() => {
        setMounted(true);
        setTimeout(() => textareaRef.current?.focus(), 150);
      });
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && tab === "mine" && userId) loadMyInquiries();
  }, [isOpen, tab]);

  async function loadMyInquiries() {
    setMyLoading(true);
    try {
      const data = await fetchMyInquiries(userId);
      setMyInquiries(data);
    } catch (e: any) {
      onToast(e.message || "내 문의를 불러오지 못했습니다.", true);
    } finally {
      setMyLoading(false);
    }
  }

  async function handleSubmit() {
    if (!message.trim()) { onToast("문의 내용을 입력해주세요.", true); return; }
    setLoading(true);
    try {
      await postInquiry(userId || "익명", subject.trim(), message.trim());
      onToast("문의가 접수되었습니다! 📩");
      setSubject(""); setMessage("");
      if (userId) { setTab("mine"); loadMyInquiries(); }
      else onClose();
    } catch (e: any) {
      onToast(e.message || "문의 제출에 실패했습니다.", true);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className={`lm-backdrop${mounted ? " lm-backdrop--in" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`lm-card${mounted ? " lm-card--in" : ""}`}
        style={{ maxWidth: 500, width: "94vw" }}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        {/* 헤더 */}
        <div className="lm-header">
          <div className="lm-logo">
            <span className="lm-logo-dot" />
            <span className="lm-logo-text">문의하기</span>
          </div>
          <button className="lm-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 탭 */}
        <div className="lm-tabs" style={{ margin: "14px 20px 0" }}>
          {(["write","mine"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`lm-tab${tab === t ? " lm-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "write" ? "문의 작성" : "내 문의"}
            </button>
          ))}
          <span
            className="lm-tab-indicator"
            style={{ transform: `translateX(${tab === "write" ? "0%" : "100%"})` }}
          />
        </div>

        {/* ── 문의 작성 탭 ── */}
        {tab === "write" && (
          <>
            <div style={{ padding: "18px 20px 6px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* 보내는 사람 */}
              <div className="lm-field">
                <label className="lm-label">보내는 사람</label>
                <div className="lm-input-wrap">
                  <svg className="lm-input-icon" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input className="lm-input" type="text" value={userId || "익명"} disabled style={{ opacity: 0.55 }} />
                </div>
                {!userId && (
                  <p style={{ margin: "5px 0 0", fontSize: 11.5, color: "var(--text-secondary)", opacity: 0.7 }}>
                    비로그인 상태에서는 답변을 확인할 수 없어요.
                  </p>
                )}
              </div>

              {/* 제목 */}
              <div className="lm-field">
                <label className="lm-label">제목 <span style={{ fontWeight: 400, opacity: 0.45 }}>(선택)</span></label>
                <div className="lm-input-wrap">
                  <svg className="lm-input-icon" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none">
                    <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/>
                  </svg>
                  <input
                    className="lm-input" type="text" value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="문의 제목" maxLength={100} disabled={loading}
                  />
                </div>
              </div>

              {/* 내용 */}
              <div className="lm-field">
                <label className="lm-label">내용 <span style={{ color: "#ff8c42" }}>*</span></label>
                <textarea
                  ref={textareaRef}
                  className="lm-textarea"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="문의 내용을 자세히 적어주세요."
                  maxLength={2000} disabled={loading} rows={6}
                />
                <p style={{ margin: "4px 0 0", textAlign: "right", fontSize: 11,
                  opacity: message.length > 1800 ? 1 : 0.5,
                  color: message.length > 1800 ? "#e06c6c" : "var(--text-secondary)" as any }}>
                  {message.length} / 2000
                </p>
              </div>
            </div>

            <div className="lm-actions">
              <button className="lm-btn lm-btn--ghost" onClick={onClose} disabled={loading}>취소</button>
              <button className="lm-btn lm-btn--primary" onClick={handleSubmit} disabled={loading || !message.trim()}>
                {loading ? <span className="lm-spinner" /> : "제출하기"}
              </button>
            </div>
          </>
        )}

        {/* ── 내 문의 탭 ── */}
        {tab === "mine" && (
          <>
            {!userId ? (
              <div style={{ padding: "52px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  로그인 후 내 문의를 확인할 수 있어요.
                </div>
              </div>
            ) : myLoading ? (
              <div style={{ padding: "52px 20px", textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
                불러오는 중…
              </div>
            ) : myInquiries.length === 0 ? (
              <div style={{ padding: "52px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>아직 보낸 문의가 없어요.</div>
              </div>
            ) : (
              <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "14px 18px 6px" }}>
                {myInquiries.map((item) => {
                  const answered  = Boolean(item.admin_reply);
                  const expanded  = expandedId === item.id;
                  return (
                    <div
                      key={item.id}
                      style={{
                        borderRadius: 10,
                        border: `1px solid ${answered ? "rgba(76,175,80,0.25)" : "rgba(255,255,255,0.08)"}`,
                        marginBottom: 10,
                        overflow: "hidden",
                        background: answered ? "rgba(76,175,80,0.04)" : "transparent",
                        transition: "border-color .15s",
                      }}
                    >
                      {/* 요약행 */}
                      <div
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        style={{
                          padding: "12px 14px", cursor: "pointer",
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 700, fontSize: 13.5,
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {item.subject || "(제목 없음)"}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 3 }}>
                            {formatDate(item.created_at)}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                            background: answered ? "rgba(76,175,80,0.15)" : "rgba(255,159,67,0.15)",
                            color:      answered ? "#4caf50"              : "#ff9f43",
                          }}>
                            {answered ? "✓ 답변완료" : "대기중"}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", opacity: 0.5 }}>
                            {expanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </div>

                      {/* 펼친 내용 */}
                      {expanded && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px 14px" }}>
                          {/* 내 문의 내용 */}
                          <div style={{
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 8, padding: "10px 13px",
                            fontSize: 13, color: "var(--text-primary)",
                            lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                          }}>
                            {item.message}
                          </div>

                          {/* 관리자 답변 */}
                          {answered && (
                            <div style={{
                              marginTop: 10,
                              background: "rgba(76,175,80,0.08)",
                              border: "1px solid rgba(76,175,80,0.2)",
                              borderRadius: 8, padding: "10px 13px",
                            }}>
                              <div style={{
                                display: "flex", alignItems: "center", gap: 6,
                                marginBottom: 7, fontSize: 11.5, fontWeight: 700, color: "#4caf50",
                              }}>
                                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none">
                                  <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
                                </svg>
                                관리자 답변
                                {item.replied_at && (
                                  <span style={{ fontWeight: 500, opacity: 0.65, fontSize: 11 }}>
                                    · {formatDate(item.replied_at)}
                                  </span>
                                )}
                              </div>
                              <div style={{
                                fontSize: 13, color: "var(--text-primary)",
                                lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                              }}>
                                {item.admin_reply}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="lm-actions" style={{ justifyContent: "space-between" }}>
              {userId && (
                <button className="lm-btn lm-btn--ghost" onClick={loadMyInquiries} disabled={myLoading}
                  style={{ flex: "none", padding: "8px 14px", fontSize: 12 }}>
                  {myLoading ? "…" : "↻ 새로고침"}
                </button>
              )}
              <button className="lm-btn lm-btn--ghost" onClick={onClose} style={{ marginLeft: "auto" }}>닫기</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}