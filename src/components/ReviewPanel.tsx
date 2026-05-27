import React, { useState } from "react";
import type { MealType } from "../types";

interface ReviewItem {
  text: string;
  time: string;
}

interface ReviewPanelProps {
  viewDate: Date;
  mealType: MealType;
  onToast: (msg: string, isError?: boolean) => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
  viewDate,
  mealType,
  onToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [reviews, setReviews] = useState<ReviewItem[]>([
    { text: "오늘 고기반찬 폼 미쳤다... 👍", time: "12:00" },
    { text: "국이 조금 짰어요 ㅠㅠ", time: "12:05" },
  ]);

  const m = String(viewDate.getMonth() + 1).padStart(2, "0");
  const d = String(viewDate.getDate()).padStart(2, "0");

  function togglePanel() {
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
    setReviews((prev) => [{ text, time }, ...prev]);
    setInputValue("");
  }

  return (
    <div className="review-slide-container">
      <button
        className={`review-trigger${isOpen ? " panel-open" : ""}`}
        onClick={togglePanel}
      >
        💬 리뷰 보기 및 작성
      </button>
      <div className={`review-panel${isOpen ? " open" : ""}`}>
        <div className="review-header">
          <h3>
            {parseInt(m)}월 {parseInt(d)}일의 급식 리뷰 ({mealType})
          </h3>
        </div>
        <div className="review-content">
          {reviews.map((r, i) => (
            <div key={i} className="review-item">
              <strong>익명</strong>{" "}
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                {r.time}
              </span>
              <div style={{ marginTop: "5px" }}>{r.text}</div>
            </div>
          ))}
        </div>
        <div className="review-input-box">
          <input
            type="text"
            value={inputValue}
            placeholder="바르고 고운 말로 리뷰를 남겨주세요..."
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitReview();
            }}
          />
          <button onClick={submitReview}>등록</button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel;
