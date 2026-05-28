import React, { useState, useEffect, useRef, useCallback } from "react";
import type { MealType } from "../types";

interface ReviewItem {
  id: string | number;
  text: string;
  time: string;
  author: string;
}

interface ReviewPanelProps {
  viewDate: Date;
  mealType: MealType;
  username: string;        // 로그인 유저 아이디. 비로그인 시 ""
  onToast: (msg: string, isError?: boolean) => void;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// 🛑 금지어 목록 (필요에 따라 계속 추가하세요)
const BAD_WORDS = ["시발", "씨발", "병신", "새끼", "지랄", "미친", "개새", "존나"];

const ReviewPanel: React.FC<ReviewPanelProps> = ({ viewDate, mealType, username, onToast }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const m = String(viewDate.getMonth() + 1).padStart(2, "0");
  const d = String(viewDate.getDate()).padStart(2, "0");
  const dateStr = toDateStr(viewDate);

  // 날짜 또는 식사 유형 바뀌면 리뷰 다시 불러옴
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reviews?date=${dateStr}&meal_type=${encodeURIComponent(mealType)}`
      );
      if (!res.ok) throw new Error();
      const data: ReviewItem[] = await res.json();
      setReviews(data);
    } catch {
      if (isOpen) onToast("리뷰를 불러오지 못했습니다.", true);
    } finally {
      setLoading(false);
    }
  }, [dateStr, mealType, isOpen, onToast]);

  useEffect(() => {
    if (isOpen) fetchReviews();
    else setReviews([]);
  }, [isOpen, fetchReviews]);

  function toggleReview() {
    setIsOpen((prev) => !prev);
  }

  async function submitReview() {
    const text = inputValue.trim();
    if (!text) {
      onToast("리뷰 내용을 입력해주세요!", true);
      return;
    }

    const hasBadWord = BAD_WORDS.some((word) => text.includes(word));
    if (hasBadWord) {
      onToast("욕설이나 비속어는 포함할 수 없습니다.", true);
      return;
    }

    const authorName = username ? username : "익명";

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          meal_type: mealType,
          user_id: authorName, // 백엔드로 보낼 때 "익명" 또는 "실제아이디" 전송
          text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.detail || "리뷰 등록에 실패했습니다.", true);
        return;
      }
      
      setReviews((prev) => [data.review, ...prev]);
      setInputValue("");
    } catch {
      onToast("서버에 연결할 수 없습니다.", true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="review-slide-container">
      <button
        ref={inputRef as any}
        className="review-trigger"
        id="reviewTriggerBtn"
        style={{ bottom: isOpen ? "calc(100% - 92px)" : "0" }}
        onClick={toggleReview}
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
              </div>
            ))
          )}
        </div>

        <div className="review-input-box">
          <span className="review-input-user">{username ? username : "익명"}</span>
          <input
            type="text"
            id="reviewInput"
            value={inputValue}
            placeholder="바르고 고운 말로 리뷰를 남겨주세요..."
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !submitting) submitReview(); }}
            disabled={submitting}
          />
          <button onClick={submitReview} disabled={submitting}>
            {submitting ? "…" : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel;