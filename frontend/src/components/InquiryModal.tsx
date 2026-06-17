import React, { useState, useEffect, useRef } from "react";
import { postInquiry } from "../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;   // 로그인한 경우 user_id, 아니면 ""
  onToast: (msg: string, isError?: boolean) => void;
}

export default function InquiryModal({ isOpen, onClose, userId, onToast }: Props) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSubject(""); setMessage(""); setLoading(false);
      requestAnimationFrame(() => {
        setMounted(true);
        setTimeout(() => textareaRef.current?.focus(), 120);
      });
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedLen = message.trim().length;
  const nearLimit = message.length > 1800;

  async function handleSubmit() {
    if (!message.trim()) {
      onToast("문의 내용을 입력해주세요.", true);
      return;
    }
    setLoading(true);
    try {
      await postInquiry(userId || "익명", subject.trim(), message.trim());
      onToast("문의가 접수되었습니다! 빠르게 답변드리겠습니다. 📩");
      onClose();
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

        <div className="lm-form" style={{ padding: "20px 22px 6px", gap: 16 }}>
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
              <div className="lm-hint">로그인하지 않으면 익명으로 접수됩니다.</div>
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
            <label className="lm-label">
              문의 내용 <span style={{ color: "#ff8c42" }}>*</span>
            </label>
            <textarea
              ref={textareaRef}
              className="lm-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="문의 내용을 자세히 작성해주세요. 어떤 화면에서, 어떤 문제가 있었는지 적어주시면 더 빠르게 도와드릴 수 있어요."
              maxLength={2000}
              disabled={loading}
              rows={7}
            />
            <div
              style={{
                textAlign: "right",
                fontSize: 11,
                color: nearLimit ? "#e76b5f" : "var(--text-secondary)",
                marginTop: 4,
                opacity: nearLimit ? 1 : 0.6,
              }}
            >
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
            disabled={loading || trimmedLen === 0}
          >
            {loading ? <span className="lm-spinner" /> : "제출"}
          </button>
        </div>
      </div>
    </div>
  );
}