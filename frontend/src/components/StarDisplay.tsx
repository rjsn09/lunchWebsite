import React from "react";

interface StarDisplayProps {
  score: number;
}

const StarDisplay: React.FC<StarDisplayProps> = ({ score }) => {
  return (
    <span className="star-display">
      {Array.from({ length: 5 }, (_, i) => {
        const idx = i + 1;
        if (score >= idx) {
          return (
            <span key={i} className="s-on">
              ★
            </span>
          );
        } else if (score >= idx - 0.5) {
          return (
            <span key={i} className="s-half">
              <span className="s-half-bg">★</span>
              <span className="s-half-fg">★</span>
            </span>
          );
        } else {
          return (
            <span key={i} className="s-off">
              ★
            </span>
          );
        }
      })}
    </span>
  );
};

export default StarDisplay;
