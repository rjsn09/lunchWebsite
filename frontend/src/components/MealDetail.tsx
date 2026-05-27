import React, { useEffect, useState } from "react";
import type { Meal, MealType } from "../types";
import StarDisplay from "./StarDisplay";

interface MealDetailProps {
  viewDate: Date;
  meals: Meal[];
  mealType: MealType;
  score: number;
  onMealTypeChange: (t: MealType) => void;
}

const MEAL_TYPES: MealType[] = ["조식", "중식", "석식"];

const MealDetail: React.FC<MealDetailProps> = ({
  viewDate, meals, mealType, score, onMealTypeChange,
}) => {
  const y = viewDate.getFullYear();
  const m = String(viewDate.getMonth() + 1).padStart(2, "0");
  const d = String(viewDate.getDate()).padStart(2, "0");

  const targetMeal = meals.find((meal) => meal.MMEAL_SC_NM === mealType);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [noPhotoText, setNoPhotoText] = useState("사진을 불러오는 중...");

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
    if (!targetMeal?.IMG_PATH) {
      setNoPhotoText("해당 급식의 사진을 찾을 수 없습니다.");
    } else {
      setNoPhotoText("사진을 불러오는 중...");
    }
  }, [targetMeal?.IMG_PATH, mealType, viewDate]);

  return (
    <section className="panel middle-panel">
      <div className="middle-panel-header" id="selectedDateHeader">
        {y}년 {m}월 {d}일 급식 정보
      </div>

      <div className="meal-tabs" id="mealTabs">
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            className={`meal-tab-btn${mealType === t ? " active" : ""}`}
            onClick={() => onMealTypeChange(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 사진 영역 — 원본과 동일한 구조 */}
      <div style={{
        position: "relative", width: "100%", height: "140px", marginBottom: "10px",
        backgroundColor: "var(--panel-bg)", border: "1px solid var(--table-border)",
        borderRadius: "8px", display: "flex", alignItems: "center",
        justifyContent: "center", overflow: "hidden",
      }}>
        {targetMeal?.IMG_PATH && (
          <img
            className="meal-photo"
            style={{ margin: 0, border: "none", position: "absolute", zIndex: 2, display: imgLoaded && !imgError ? "block" : "none" }}
            src={targetMeal.IMG_PATH}
            alt="급식 사진"
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgError(true); setNoPhotoText("해당 급식의 사진을 찾을 수 없습니다."); }}
          />
        )}
        <span id="no-photo-text" style={{
          color: "var(--text-secondary)", fontSize: "0.9rem", zIndex: 1,
          display: imgLoaded && !imgError ? "none" : "block",
        }}>
          {noPhotoText}
        </span>
      </div>

      <div className="meal-list-wrap">
        <table className="meal-table">
          <thead>
            <tr><th style={{ width: "100%", textAlign: "center" }}>반찬명</th></tr>
          </thead>
          <tbody id="dynamicMealBody">
            {targetMeal ? (
              <>
                <tr>
                  <td style={{ textAlign: "center", padding: "8px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--table-border)" }}>
                    <StarDisplay score={score} />
                  </td>
                </tr>
                <tr>
                  <td style={{ background: "rgba(255,255,255,0.05)", fontWeight: "bold", textAlign: "center", color: "var(--tab-active-bg)", padding: "6px" }}>
                    [ {mealType} ]{" "}
                    <span style={{ fontSize: "0.8em", color: "var(--text-secondary)", fontWeight: "normal" }}>
                      ({targetMeal.CAL_INFO})
                    </span>
                  </td>
                </tr>
                {targetMeal.DDISH_NM.map((menu, i) => (
                  <tr key={i}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--table-border)", textAlign: "center" }}>
                      {menu}
                    </td>
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>
                  해당 날짜에 {mealType} 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MealDetail;
