import React, { useState, useEffect, useRef } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string, token: string) => void;
  onToast: (msg: string, isError?: boolean) => void;
}

type Tab = "login" | "register";

export default function LoginModal({ isOpen, onClose, onLoginSuccess, onToast }: Props) {
  const [tab, setTab] = useState<Tab>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 열릴 때마다 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setUsername("");
      setPassword("");
      setPasswordConfirm("");
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // 탭 전환 시 폼 초기화
  useEffect(() => {
    setUsername("");
    setPassword("");
    setPasswordConfirm("");
  }, [tab]);

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      onToast("아이디와 비밀번호를 입력해주세요.", true);
      return;
    }
    if (tab === "register" && password !== passwordConfirm) {
      onToast("비밀번호가 일치하지 않습니다.", true);
      return;
    }

    const endpoint = tab === "login" ? "/api/login" : "/api/register";
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.message || (tab === "login" ? "로그인에 실패했습니다." : "회원가입에 실패했습니다."), true);
        return;
      }
      if (tab === "register") {
        onToast("회원가입이 완료되었습니다! 로그인해주세요. 🎉");
        setTab("login");
      } else {
        onToast(`${data.username ?? username}님, 환영합니다! 👋`);
        onLoginSuccess(data.username ?? username, data.token ?? "");
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
      className="not-supported-overlay"
      style={{ display: "flex" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="login-modal" onKeyDown={handleKeyDown}>
        {/* 탭 */}
        <div className="login-tabs">
          <button
            className={`login-tab${tab === "login" ? " active" : ""}`}
            onClick={() => setTab("login")}
          >
            로그인
          </button>
          <button
            className={`login-tab${tab === "register" ? " active" : ""}`}
            onClick={() => setTab("register")}
          >
            회원가입
          </button>
        </div>

        {/* 폼 */}
        <div className="login-form">
          <div className="login-field">
            <label>아이디</label>
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="login-field">
            <label>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              disabled={loading}
            />
          </div>
          {tab === "register" && (
            <div className="login-field">
              <label>비밀번호 확인</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="login-actions">
          <button className="login-cancel-btn" onClick={onClose} disabled={loading}>
            취소
          </button>
          <button className="login-submit-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? "처리 중..." : tab === "login" ? "로그인" : "가입하기"}
          </button>
        </div>
      </div>
    </div>
  );
}