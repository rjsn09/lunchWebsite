import React, { useState, useEffect, useRef } from "react";
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

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function AdminPanel({ isOpen, onClose, adminUserId, onToast }: Props) {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [filter, setFilter]       = useState<Filter>("all");
  const [activeId, setActiveId]   = useState<string | number | null>(null);

  // 답변 작성 상태
  const [draftMap, setDraftMap]   = useState<Record<string | number, string>>({});
  const [sendingId, setSendingId] = useState<string | number | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setMounted(true));
      load();
    } else {
      setMounted(false);
      setInquiries([]); setActiveId(null); setFilter("all"); setDraftMap({});
    }
  }, [isOpen]);

  // 항목 열릴 때 답변창 포커스
  useEffect(() => {
    if (activeId != null) setTimeout(() => replyRef.current?.focus(), 80);
  }, [activeId]);

  async function load() {
    setLoading(true);
    try {
      setInquiries(await fetchInquiries(adminUserId));
    } catch (e: any) {
      onToast(e.message || "문의 목록을 불러오지 못했습니다.", true);
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(item: InquiryItem) {
    const text = (draftMap[item.id] ?? item.admin_reply ?? "").trim();
    if (!text) { onToast("답변 내용을 입력해주세요.", true); return; }
    setSendingId(item.id);
    try {
      await replyToInquiry(item.id, text, adminUserId);
      setInquiries((prev) =>
        prev.map((i) => i.id === item.id
          ? { ...i, admin_reply: text, replied_at: new Date().toISOString() }
          : i)
      );
      // 드래프트 정리
      setDraftMap((prev) => { const n = {...prev}; delete n[item.id]; return n; });
      onToast("답변을 등록했습니다. ✅");
    } catch (e: any) {
      onToast(e.message || "답변 등록에 실패했습니다.", true);
    } finally {
      setSendingId(null);
    }
  }

  if (!isOpen) return null;

  const unanswered = inquiries.filter((i) => !i.admin_reply).length;
  const visible    = filter === "unanswered" ? inquiries.filter((i) => !i.admin_reply) : inquiries;
  const active     = visible.find((i) => i.id === activeId) ?? null;

  return (
    <div
      className={`lm-backdrop${mounted ? " lm-backdrop--in" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`lm-card${mounted ? " lm-card--in" : ""}`}
        style={{ maxWidth: 860, width: "96vw", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        {/* 헤더 */}
        <div className="lm-header" style={{ flexShrink: 0 }}>
          <div className="lm-logo">
            <span className="lm-logo-dot" style={{ background: "#e74c3c" }} />
            <span className="lm-logo-text">관리자 — 문의 관리</span>
            <span className="lm-count-badge">{inquiries.length}건</span>
            {unanswered > 0 && (
              <span className="lm-count-badge unread">미답변 {unanswered}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={load} disabled={loading}
              style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.15)",
                borderRadius:6, padding:"4px 12px", fontSize:12, color:"var(--text-secondary)",
                cursor: loading ? "not-allowed":"pointer", fontFamily:"inherit" }}>
              {loading ? "…" : "↻ 새로고침"}
            </button>
            <button className="lm-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 필터 */}
        <div style={{ padding: "10px 20px 0", display: "flex", gap: 8, flexShrink: 0 }}>
          {(["all","unanswered"] as Filter[]).map((f) => (
            <button key={f}
              className={`lm-filter-pill${filter === f ? " active" : ""}`}
              onClick={() => { setFilter(f); setActiveId(null); }}>
              {f === "all" ? "전체" : "미답변만"}
            </button>
          ))}
        </div>

        {/* 본문: 목록 + 상세 2컬럼 */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, marginTop: 12, gap: 0 }}>

          {/* ── 왼쪽: 목록 ── */}
          <div style={{
            width: 280, flexShrink: 0,
            overflowY: "auto",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            padding: "0 0 12px",
          }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                불러오는 중…
              </div>
            ) : visible.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                {filter === "unanswered" ? "미답변 문의가 없어요." : "문의가 없어요."}
              </div>
            ) : visible.map((item) => {
              const answered = Boolean(item.admin_reply);
              const isActive = activeId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveId(isActive ? null : item.id)}
                  style={{
                    padding: "11px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--tab-active-bg)" : "3px solid transparent",
                    transition: "background .12s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {!answered && (
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#ff9f43", flexShrink: 0,
                        boxShadow: "0 0 4px rgba(255,159,67,.7)",
                      }} />
                    )}
                    <div style={{
                      fontWeight: 600, fontSize: 13,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      flex: 1,
                    }}>
                      {item.subject || "(제목 없음)"}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-secondary)", opacity: 0.75 }}>
                      {item.user_id}
                    </span>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                      background: answered ? "rgba(76,175,80,0.15)" : "rgba(255,159,67,0.15)",
                      color: answered ? "#4caf50" : "#ff9f43",
                    }}>
                      {answered ? "완료" : "대기"}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-secondary)", opacity: 0.45, marginTop: 3 }}>
                    {formatDate(item.created_at)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 오른쪽: 상세 + 답변 ── */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "4px 20px 16px" }}>
            {!active ? (
              <div style={{
                height: "100%", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)", fontSize: 13, opacity: 0.5, gap: 10,
              }}>
                <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="1.2" fill="none">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                왼쪽 목록에서 문의를 선택하세요
              </div>
            ) : (
              <>
                {/* 문의 정보 */}
                <div style={{ paddingTop: 10, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                      {active.subject || "(제목 없음)"}
                    </h3>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, display: "flex", gap: 12 }}>
                    <span>보낸이: <strong style={{ color: "#ff9f43" }}>{active.user_id}</strong></span>
                    <span>{formatDate(active.created_at)}</span>
                  </div>

                  {/* 문의 내용 박스 */}
                  <div style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10, padding: "13px 15px",
                    fontSize: 13.5, color: "var(--text-primary)",
                    lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {active.message}
                  </div>
                </div>

                {/* 기존 답변 표시 */}
                {active.admin_reply && (
                  <div style={{
                    background: "rgba(76,175,80,0.07)",
                    border: "1px solid rgba(76,175,80,0.22)",
                    borderRadius: 10, padding: "12px 15px", marginBottom: 16,
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: 12, fontWeight: 700, color: "#4caf50", marginBottom: 8,
                    }}>
                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none">
                        <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
                      </svg>
                      등록된 답변
                      {active.replied_at && (
                        <span style={{ fontWeight: 500, opacity: 0.65 }}>
                          · {formatDate(active.replied_at)}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 13.5, color: "var(--text-primary)",
                      lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {active.admin_reply}
                    </div>
                  </div>
                )}

                {/* 답변 작성/수정 */}
                <div style={{
                  background: "rgba(255,159,67,0.05)",
                  border: "1px solid rgba(255,159,67,0.2)",
                  borderRadius: 10, padding: "14px 15px",
                }}>
                  <label style={{
                    display: "block", fontSize: 12, fontWeight: 700,
                    color: "#ff9f43", marginBottom: 8, letterSpacing: "0.04em",
                  }}>
                    {active.admin_reply ? "✏️ 답변 수정" : "✍️ 답변 작성"}
                  </label>
                  <textarea
                    ref={replyRef}
                    className="lm-textarea"
                    rows={5}
                    value={draftMap[active.id] ?? active.admin_reply ?? ""}
                    onChange={(e) =>
                      setDraftMap((prev) => ({ ...prev, [active.id]: e.target.value }))
                    }
                    placeholder="답변 내용을 입력하세요..."
                    disabled={sendingId === active.id}
                    style={{
                      borderColor: "rgba(255,159,67,0.3)",
                      background: "rgba(255,255,255,0.04)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button
                      className="lm-btn lm-btn--primary"
                      style={{ flex: "none", padding: "9px 22px" }}
                      disabled={sendingId === active.id}
                      onClick={() => sendReply(active)}
                    >
                      {sendingId === active.id ? <span className="lm-spinner" /> :
                        (active.admin_reply ? "답변 수정하기" : "답변 보내기")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 하단 */}
        <div style={{ padding: "10px 20px 16px", textAlign: "right", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button className="lm-btn lm-btn--ghost" onClick={onClose} style={{ minWidth: 80 }}>닫기</button>
        </div>
      </div>
    </div>
  );
}