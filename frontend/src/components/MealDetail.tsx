import React from "react";
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
  viewDate,
  meals,
  mealType,
  score,
  onMealTypeChange,
}) => {
  const y = viewDate.getFullYear();
  const m = String(viewDate.getMonth() + 1).padStart(2, "0");
  const d = String(viewDate.getDate()).padStart(2, "0");

  const targetMeal = meals.find((meal) => meal.MMEAL_SC_NM === mealType);

  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [targetMeal?.IMG_PATH]);

  return (
    <section className="panel middle-panel">
      <div className="middle-panel-header">
        {y}년 {m}월 {d}일 급식 정보
      </div>

      <div className="meal-tabs">
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

      <div className="meal-photo-wrap">
        {targetMeal?.IMG_PATH && !imgError ? (
          <>
            <img
              className="meal-photo"
              src={targetMeal.IMG_PATH}
              alt="급식 사진"
              style={{ display: imgLoaded ? "block" : "none" }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
            {!imgLoaded && (
              <span className="no-photo-text">사진을 불러오는 중...</span>
            )}
          </>
        ) : (
          <span className="no-photo-text">
            {targetMeal
              ? "해당 급식의 사진을 찾을 수 없습니다."
              : "사진을 불러오는 중..."}
          </span>
        )}
      </div>

      <div className="meal-list-wrap">
        <table className="meal-table">
          <thead>
            <tr>
              <th style={{ width: "100%", textAlign: "center" }}>반찬명</th>
            </tr>
          </thead>
          <tbody>
            {targetMeal ? (
              <>
                <tr>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "8px",
                      background: "rgba(255,255,255,0.04)",
                      borderBottom: "1px solid var(--table-border)",
                    }}
                  >
                    <StarDisplay score={score} />
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      fontWeight: "bold",
                      textAlign: "center",
                      color: "var(--tab-active-bg)",
                      padding: "6px",
                    }}
                  >
                    [ {mealType} ]{" "}
                    <span
                      style={{
                        fontSize: "0.8em",
                        color: "var(--text-secondary)",
                        fontWeight: "normal",
                      }}
                    >
                      ({targetMeal.CAL_INFO})
                    </span>
                  </td>
                </tr>
                {targetMeal.DDISH_NM.map((menu, i) => (
                  <tr key={i}>
                    <td
                      style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid var(--table-border)",
                        textAlign: "center",
                      }}
                    >
                      {menu}
                    </td>
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                  }}
                >
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
