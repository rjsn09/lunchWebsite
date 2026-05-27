import React from "react";
import type { Meal, MealData, MealType } from "../types";

interface WeeklyPanelProps {
  viewDate: Date;
  allMealData: MealData;
  weeklyMealType: MealType;
  onWeeklyMealTypeChange: (t: MealType) => void;
}

const MEAL_TYPES: MealType[] = ["조식", "중식", "석식"];
const DAY_LABELS = ["월요일", "화요일", "수요일", "목요일", "금요일"];

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d;
}

function getWeekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

const WeeklyPanel: React.FC<WeeklyPanelProps> = ({
  viewDate,
  allMealData,
  weeklyMealType,
  onWeeklyMealTypeChange,
}) => {
  const monday = getWeekMonday(viewDate);
  const weekMonth = monday.getMonth() + 1;
  const weekNum = getWeekOfMonth(monday);

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <section className="panel today-meal-panel">
      <h2 className="today-meal-header">
        {weekMonth}월 {weekNum}째주 급식 (인천전자마이스터고)
      </h2>
      <div className="meal-tabs" style={{ justifyContent: "flex-start", marginBottom: "12px" }}>
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            className={`meal-tab-btn${weeklyMealType === t ? " active" : ""}`}
            onClick={() => onWeeklyMealTypeChange(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="weekly-table-wrap">
        <table className="meal-table">
          <thead>
            <tr>
              <th style={{ width: "20%", textAlign: "center" }}>요일</th>
              <th style={{ textAlign: "center" }}>식단 메뉴</th>
            </tr>
          </thead>
          <tbody>
            {weekDays.map((d, i) => {
              const dStr = toDateStr(d);
              const meals: Meal[] = allMealData[dStr] || [];
              const target = meals.find((m) => m.MMEAL_SC_NM === weeklyMealType);
              return (
                <tr key={i}>
                  <td style={{ textAlign: "center" }}>{DAY_LABELS[i]}</td>
                  <td>{target ? target.DDISH_NM.join(", ") : "데이터 없음"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default WeeklyPanel;
