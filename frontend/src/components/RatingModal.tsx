import React, { useState, useRef, useEffect } from "react";

interface RatingModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  initialScore: number;
  onClose: () => void;
  onConfirm: (score: number) => Promise<void>;
}

const RatingModal: React.FC<RatingModalProps> = ({
  isOpen, title, subtitle, initialScore, onClose, onConfirm,
}) => {
  const [tempScore, setTempScore] = useState<number>(initialScore);
  const [hoverScore, setHoverScore] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const wrapsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    setTempScore(initialScore);
  }, [initialScore, isOpen]);

  function getScoreFromMouseX(e: React.MouseEvent, idx: number): number {
    const el = wrapsRef.current[idx - 1];
    if (!el) return idx;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return x < rect.width / 2 ? idx - 0.5 : idx;
  }

  // 원본 로직: wraps 배열을 뒤에서부터 순회해서 좌표 기반으로 score 계산
  function getScoreFromEvent(e: React.MouseEvent): number {
    for (let i = wrapsRef.current.length - 1; i >= 0; i--) {
      const el = wrapsRef.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left) {
        const x = e.clientX - rect.left;
        const idx = i + 1;
        return x < rect.width / 2 ? idx - 0.5 : idx;
      }
    }
    return 0.5;
  }

  function getStarClass(idx: number): string {
    const active = hoverScore > 0 ? hoverScore : tempScore;
    if (hoverScore > 0) {
      if (hoverScore >= idx) return "hover-full";
      if (hoverScore >= idx - 0.5) return "hover-half";
      return "";
    }
    if (tempScore >= idx) return "full-fill";
    if (tempScore >= idx - 0.5) return "half-fill";
    return "";
  }

  async function handleConfirm() {
    if (tempScore === 0) return;
    setSaving(true);
    try {
      await onConfirm(tempScore);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      id="ratingOverlay"
      style={{ display: "flex", position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rating-card">
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        <h2 id="modalTitle">{title}</h2>
        <p className="rating-subtitle" id="modalSubtitle">{subtitle}</p>

        <div
          className="star-box"
          id="starBox"
          onMouseLeave={() => { setHoverScore(0); }}
        >
          {[1, 2, 3, 4, 5].map((idx) => (
            <span
              key={idx}
              className={`star-wrap ${getStarClass(idx)}`}
              data-idx={idx}
              ref={(el) => { wrapsRef.current[idx - 1] = el; }}
              onMouseMove={(e) => {
                const s = getScoreFromEvent(e);
                setHoverScore(s);
              }}
              onClick={(e) => {
                const s = getScoreFromEvent(e);
                setTempScore(s);
                setHoverScore(0);
              }}
            >
              <span className="star-bg">★</span>
              <span className="star-half">★</span>
              <span className="star-full">★</span>
            </span>
          ))}
        </div>

        <button
          className="confirm-btn"
          id="confirmBtn"
          disabled={tempScore === 0 || saving}
          onClick={handleConfirm}
        >
          {saving ? "저장 중..." : "확인"}
        </button>
      </div>
    </div>
  );
};

export default RatingModal;
