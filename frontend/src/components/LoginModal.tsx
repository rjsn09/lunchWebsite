import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import "../login-modal.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string, token: string, isAdmin: boolean) => void;
  onToast: (msg: string, isError?: boolean) => void;
}

type Tab = "login" | "register";

export default function LoginModal({ isOpen, onClose, onLoginSuccess, onToast }: Props) {
  const [tab, setTab] = useState<Tab>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername(""); setPassword(""); setPasswordConfirm("");
      setLoading(false);
      requestAnimationFrame(() => {
        setMounted(true);
        setTimeout(() => inputRef.current?.focus(), 120);
      });
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setUsername(""); setPassword(""); setPasswordConfirm("");
  }, [tab]);

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      onToast("아이디와 비밀번호를 입력해주세요.", true); return;
    }
    if (tab === "register" && password !== passwordConfirm) {
      onToast("비밀번호가 일치하지 않습니다.", true); return;
    }
    const endpoint = tab === "login" ? "/api/login" : "/api/register";
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.detail || (tab === "login" ? "로그인에 실패했습니다." : "회원가입에 실패했습니다."), true);
        return;
      }
      if (tab === "register") {
        onToast("회원가입이 완료되었습니다! 로그인해주세요. 🎉");
        setTab("login");
      } else {
        const displayName = data.user_id ?? username.trim();
        onToast(`${displayName}님, 환영합니다! 👋`);
        onLoginSuccess(displayName, data.token ?? "", Boolean(data.is_admin));
        onClose();
      }
    } catch {
      onToast("서버에 연결할 수 없습니다.", true);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onClose();
  }

  return (
    <div
      className={`lm-backdrop${mounted ? " lm-backdrop--in" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`lm-card${mounted ? " lm-card--in" : ""}`}
        onKeyDown={handleKeyDown}
      >
        {/* 헤더 */}
        <div className="lm-header">
          <div className="lm-logo">
            <span className="lm-logo-dot" />
            <span className="lm-logo-text">인마고 급식</span>
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
            className={`lm-tab${tab === "login" ? " lm-tab--active" : ""}`}
            onClick={() => setTab("login")}
          >
            로그인
          </button>
          <button
            className={`lm-tab${tab === "register" ? " lm-tab--active" : ""}`}
            onClick={() => setTab("register")}
          >
            회원가입
          </button>
          {/* 슬라이딩 인디케이터 */}
          <span
            className="lm-tab-indicator"
            style={{ transform: `translateX(${tab === "login" ? "0%" : "100%"})` }}
          />
        </div>

        {/* 폼 */}
        <div className="lm-form">
          <div className="lm-field">
            <label className="lm-label">아이디</label>
            <div className="lm-input-wrap">
              <svg className="lm-input-icon" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                className="lm-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          <div className="lm-field">
            <label className="lm-label">비밀번호</label>
            <div className="lm-input-wrap">
              <svg className="lm-input-icon" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type="password"
                className="lm-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                disabled={loading}
              />
            </div>
          </div>

          {tab === "register" && (
            <div className="lm-field lm-field--slide">
              <label className="lm-label">비밀번호 확인</label>
              <div className="lm-input-wrap">
                <svg className="lm-input-icon" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M9 12l2 2 4-4"/><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type="password"
                  className="lm-input"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        {/* 액션 */}
        <div className="lm-actions">
          <button className="lm-btn lm-btn--ghost" onClick={onClose} disabled={loading}>
            취소
          </button>
          <button className="lm-btn lm-btn--primary" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <span className="lm-spinner" />
            ) : (
              tab === "login" ? "로그인" : "가입하기"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
 