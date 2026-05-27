import React, { useState, useRef } from "react";
import type { MealType } from "../types";

interface ReviewItem {
  text: string;
  time: string;
  author: string;
}

interface ReviewPanelProps {
  viewDate: Date;
  mealType: MealType;
  onToast: (msg: string, isError?: boolean) => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({ viewDate, mealType, onToast }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [reviews, setReviews] = useState<ReviewItem[]>([
    { text: "오늘 고기반찬 폼 미쳤다... 👍", time: "12:00", author: "익명" },
    { text: "국이 조금 짰어요 ㅠㅠ", time: "12:05", author: "익명" },
  ]);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const m = String(viewDate.getMonth() + 1).padStart(2, "0");
  const d = String(viewDate.getDate()).padStart(2, "0");

  function toggleReview() {
    setIsOpen((prev) => !prev);
  }

  function submitReview() {
    const text = inputValue.trim();
    if (!text) {
      onToast("리뷰 내용을 입력해주세요!", true);
      return;
    }
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setReviews((prev) => [{ text, time, author: "익명" }, ...prev]);
    setInputValue("");
  }

  return (
    <div className="review-slide-container">
      <button
        ref={triggerRef}
        className="review-trigger"
        id="reviewTriggerBtn"
        style={{ bottom: isOpen ? "calc(100% - 62px)" : "0" }}
        onClick={toggleReview}
      >
        💬 리뷰 보기 및 작성
      </button>
      <div className={`review-panel${isOpen ? " open" : ""}`} id="reviewPanel">
        <div className="review-header">
          <h3>
            <span id="reviewDateHeader">{parseInt(m)}월 {parseInt(d)}일</span>의 급식 리뷰 (
            <span id="reviewMealType">{mealType}</span>)
          </h3>
        </div>
        <div className="review-content" id="reviewList">
          {reviews.map((r, i) => (
            <div key={i} className="review-item">
              <strong>{r.author}</strong>{" "}
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{r.time}</span>
              <div style={{ marginTop: "5px" }}>{r.text}</div>
            </div>
          ))}
        </div>
        <div className="review-input-box">
          <input
            type="text"
            id="reviewInput"
            value={inputValue}
            placeholder="바르고 고운 말로 리뷰를 남겨주세요..."
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitReview(); }}
          />
          <button onClick={submitReview}>등록</button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel;
