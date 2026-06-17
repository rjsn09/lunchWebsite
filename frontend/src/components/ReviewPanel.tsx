import React, { useState, useEffect, useRef, useCallback } from "react";
import type { MealType, ReviewItem } from "../types";
import { adminEditReview, adminDeleteReview } from "../api";

interface ReviewPanelProps {
  viewDate: Date;
  mealType: MealType;
  username: string;       // 로그인 유저 아이디. 비로그인 시 ""
  isAdmin: boolean;       // 관리자 여부
  onToast: (msg: string, isError?: boolean) => void;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

const BAN_WORDS = [
  "시발", "씨발", "씨팔", "시팔", "ㅅㅂ", "ㅆㅂ",
  "병신", "ㅂㅅ", "븅신", "뻥신",
  "새끼", "쌔끼", "ㅅㄲ",
  "지랄", "ㅈㄹ",
  "개새", "개색",
  "존나", "ㅈㄴ", "존내",
  "씹", "ㅆㅂ",
  "미친", "ㅁㅊ", "미쳤",
  "꺼져", "뒤져", "뒤지",
  "창녀", "보지", "자지", "성기",
  "애미", "애비", "에미",
  "찐따", "정신병", "장애인새", "틀딱",
  "홍어", "짱깨", "쪽바리",
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e")
    .replace(/4/g, "a").replace(/5/g, "s").replace(/8/g, "b")
    .replace(/[\s​­!@#$%^&*()_\-+=\[\]{}|;:'",.<>?/\`~]/g, "")
    .replace(/(.)​{2,}/g, "$1$1");
}

function decomposeJamo(text: string): string {
  const result: string[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - 0xAC00;
      const cho  = Math.floor(offset / 588);
      const jung = Math.floor((offset % 588) / 28);
      const jong = offset % 28;
      const CHOSUNG  = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
      const JUNGSUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
      const JONGSUNG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
      result.push(CHOSUNG[cho], JUNGSUNG[jung]);
      if (jong) result.push(JONGSUNG[jong]);
    } else {
      result.push(ch);
    }
  }
  return result.join("");
}

function containsBanWord(text: string): boolean {
  const normalized = normalizeText(text);
  const decomposed = decomposeJamo(normalized);
  const original   = normalizeText(text.replace(/\s/g, ""));
  return BAN_WORDS.some((word) =>
    normalized.includes(word) || decomposed.includes(word) || original.includes(word)
  );
}

// ── 관리자 인라인 수정 컴포넌트 ─────────────────────────
function AdminActions({
  review,
  adminUserId,
  onEdited,
  onDeleted,
  onToast,
}: {
  review: ReviewItem;
  adminUserId: string;
  onEdited: (id: string | number, newText: string) => void;
  onDeleted: (id: string | number) => void;
  onToast: (msg: string, isError?: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(review.text);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!editText.trim()) { onToast("내용을 입력해주세요.", true); return; }
    setSaving(true);
    try {
      await adminEditReview(review.id, editText, adminUserId);
      onEdited(review.id, editText.trim());
      setEditing(false);
      onToast("리뷰가 수정되었습니다.");
    } catch (e: any) {
      onToast(e.message || "수정 실패", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("이 리뷰를 삭제하시겠습니까?")) return;
    try {
      await adminDeleteReview(review.id, adminUserId);
      onDeleted(review.id);
      onToast("리뷰가 삭제되었습니다.");
    } catch (e: any) {
      onToast(e.message || "삭제 실패", true);
    }
  }

  const btnBase: React.CSSProperties = {
    padding: "3px 9px",
    borderRadius: 5,
    border: "none",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  if (editing) {
    return (
      <div style={{ marginTop: 6 }}>
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !saving) handleSave(); if (e.key === "Escape") setEditing(false); }}
          disabled={saving}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            padding: "5px 9px",
            fontSize: 13,
            color: "var(--text-primary)",
            outline: "none",
            fontFamily: "inherit",
            marginBottom: 5,
          }}
          autoFocus
        />
        <div style={{ display: "flex", gap: 5 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...btnBase, background: "#ff8c42", color: "#fff", opacity: saving ? 0.5 : 1 }}
          >
            {saving ? "…" : "저장"}
          </button>
          <button
            onClick={() => { setEditing(false); setEditText(review.text); }}
            style={{ ...btnBase, background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
      <button
        onClick={() => { setEditing(true); setEditText(review.text); }}
        style={{ ...btnBase, background: "rgba(255,200,50,0.15)", color: "#ffc832" }}
      >
        수정
      </button>
      <button
        onClick={handleDelete}
        style={{ ...btnBase, background: "rgba(231,76,60,0.15)", color: "#e74c3c" }}
      >
        삭제
      </button>
    </div>
  );
}

// ── ReviewPanel ──────────────────────────────────────
const ReviewPanel: React.FC<ReviewPanelProps> = ({ viewDate, mealType, username, isAdmin, onToast }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastFetchedKey, setLastFetchedKey] = useState("");

  const m = String(viewDate.getMonth() + 1).padStart(2, "0");
  const d = String(viewDate.getDate()).padStart(2, "0");
  const dateStr = toDateStr(viewDate);

  const fetchReviews = useCallback(async () => {
    const currentKey = `${dateStr}-${mealType}`;
    if (lastFetchedKey === currentKey && reviews.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?date=${dateStr}&meal_type=${encodeURIComponent(mealType)}`);
      if (!res.ok) throw new Error();
      const data: ReviewItem[] = await res.json();
      setReviews(data);
      setLastFetchedKey(currentKey);
    } catch {
      if (isOpen) onToast("리뷰를 불러오지 못했습니다.", true);
    } finally {
      setLoading(false);
    }
  }, [dateStr, mealType, isOpen, onToast, lastFetchedKey, reviews.length]);

  useEffect(() => {
    if (isOpen) fetchReviews();
  }, [isOpen, fetchReviews]);

  useEffect(() => {
    setReviews([]);
    setLastFetchedKey("");
  }, [dateStr, mealType]);

  async function submitReview() {
    const text = inputValue.trim();
    if (!text) { onToast("리뷰 내용을 입력해주세요!", true); return; }
    if (containsBanWord(text)) { onToast("욕설이나 비속어는 포함할 수 없습니다.", true); return; }

    const authorName = username ? username : "익명";
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, meal_type: mealType, user_id: authorName, text }),
      });
      const data = await res.json();
      if (!res.ok) { onToast(data.detail || "리뷰 등록에 실패했습니다.", true); return; }
      setReviews((prev) => [data.review, ...prev]);
      setInputValue("");
    } catch {
      onToast("서버에 연결할 수 없습니다.", true);
    } finally {
      setSubmitting(false);
    }
  }

  // 관리자 콜백
  function handleEdited(id: string | number, newText: string) {
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, text: newText } : r));
  }
  function handleDeleted(id: string | number) {
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="review-slide-container">
      <button
        ref={inputRef as any}
        className="review-trigger"
        id="reviewTriggerBtn"
        style={{ bottom: isOpen ? "calc(100% - 92px)" : "0" }}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        리뷰 보기 및 작성
      </button>

      <div className={`review-panel${isOpen ? " open" : ""}`} id="reviewPanel">
        <div className="review-header">
          <h3>
            <span>{parseInt(m)}월 {parseInt(d)}일</span>의 급식 리뷰 (
            <span>{mealType}</span>)
          </h3>
        </div>

        <div className="review-content" id="reviewList">
          {loading ? (
            <div className="review-loading">불러오는 중...</div>
          ) : reviews.length === 0 ? (
            <div className="review-empty">아직 등록된 리뷰가 없습니다.</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-item-meta">
                  <strong className="review-author">{r.author}</strong>
                  <span className="review-time">{r.time}</span>
                </div>
                <div className="review-text">{r.text}</div>

                {/* 관리자 수정/삭제 버튼 */}
                {isAdmin && (
                  <AdminActions
                    review={r}
                    adminUserId={username}
                    onEdited={handleEdited}
                    onDeleted={handleDeleted}
                    onToast={onToast}
                  />
                )}
              </div>
            ))
          )}
        </div>

        <div className="review-input-box" style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(0,0,0,0.15)",
        }}>
          <span className="review-input-user" style={{
            fontSize: "12px", fontWeight: 700, color: "#ff8c42",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {username ? username : "익명"}
          </span>
          <input
            type="text"
            id="reviewInput"
            value={inputValue}
            placeholder="리뷰를 남겨보세요"
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !submitting) submitReview(); }}
            disabled={submitting}
            style={{
              flex: 1, minWidth: 0,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px", padding: "8px 12px",
              fontSize: "13px", color: "rgba(255,255,255,0.85)",
              outline: "none", fontFamily: "inherit",
            }}
          />
          <button
            onClick={submitReview}
            disabled={submitting}
            style={{
              padding: "8px 16px", background: "#ff8c42",
              border: "none", borderRadius: "8px",
              color: "#fff", fontSize: "13px", fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.4 : 1,
              whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit",
            }}
          >
            {submitting ? "…" : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel;