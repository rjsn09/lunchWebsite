import React, { useState, useRef } from "react";

interface RatingModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  initialScore: number;
  onClose: () => void;
  onConfirm: (score: number) => Promise<void>;
}

const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  title,
  subtitle,
  initialScore,
  onClose,
  onConfirm,
}) => {
  const [tempScore, setTempScore] = useState<number>(initialScore);
  const [hoverScore, setHoverScore] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const wrapsRef = useRef<HTMLSpanElement[]>([]);

  React.useEffect(() => {
    setTempScore(initialScore);
  }, [initialScore, isOpen]);

  function getScoreFromMouseX(e: React.MouseEvent, idx: number): number {
    const rect = wrapsRef.current[idx - 1]?.getBoundingClientRect();
    if (!rect) return idx;
    const x = e.clientX - rect.left;
    return x < rect.width / 2 ? idx - 0.5 : idx;
  }

  function getStarClass(idx: number, score: number, hover: number): string {
    const active = hover > 0 ? hover : score;
    if (active >= idx) return hover > 0 ? "hover-full" : "full-fill";
    if (active >= idx - 0.5) return hover > 0 ? "hover-half" : "half-fill";
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

  return (
    <div
      className={`rating-overlay${isOpen ? " open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rating-card">
        <button className="modal-close-btn" onClick={onClose}>
          ✕
        </button>
        <h2>{title}</h2>
        <p className="rating-subtitle">{subtitle}</p>

        <div
          className="star-box"
          onMouseLeave={() => setHoverScore(0)}
        >
          {[1, 2, 3, 4, 5].map((idx) => (
            <span
              key={idx}
              className={`star-wrap ${getStarClass(idx, tempScore, hoverScore)}`}
              ref={(el) => {
                if (el) wrapsRef.current[idx - 1] = el;
              }}
              onMouseMove={(e) => setHoverScore(getScoreFromMouseX(e, idx))}
              onClick={(e) => {
                const s = getScoreFromMouseX(e, idx);
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
