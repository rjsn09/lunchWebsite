import React, { useState, useEffect, useCallback } from "react";
import Calendar from "./components/Calendar";
import MealDetail from "./components/MealDetail";
import WeeklyPanel from "./components/WeeklyPanel";
import RatingModal from "./components/RatingModal";
import ReviewPanel from "./components/ReviewPanel";
import { useToast } from "./components/useToast";
import { fetchMeals, fetchRatings, postRating } from "./api";
import type { MealData, MealType, RatingsData } from "./types";
import { Sun, Moon } from 'lucide-react';

// 원본 HTML의 SVG 상수 그대로
const MOON_SVG = `<circle cx="12" cy="12" r="10"/><path d="M14.5,7.5 A5.5,5.5 0 1,0 14.5,16.5 A3.8,3.8 0 1,1 14.5,7.5 Z" fill="currentColor" stroke="none"/>`;
const SUN_SVG  = `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/><line x1="12" y1="4.5" x2="12" y2="7.5"/><line x1="12" y1="16.5" x2="12" y2="19.5"/><line x1="4.5" y1="12" x2="7.5" y2="12"/><line x1="16.5" y1="12" x2="19.5" y2="12"/><line x1="7.3" y1="7.3" x2="9.4" y2="9.4"/><line x1="14.6" y1="14.6" x2="16.7" y2="16.7"/><line x1="16.7" y1="7.3" x2="14.6" y2="9.4"/><line x1="9.4" y1="14.6" x2="7.3" y2="16.7"/>`;

function toDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export default function App() {
  const [allMealData, setAllMealData] = useState<MealData>({});
  const [ratings, setRatings] = useState<RatingsData>({});
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
  const [currentMealType, setCurrentMealType] = useState<MealType>("조식");
  const [currentWeeklyMealType, setCurrentWeeklyMealType] = useState<MealType>("조식");
  const [isLightMode, setIsLightMode] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [notSupportedOpen, setNotSupportedOpen] = useState(false);
  const { toast, showToast } = useToast();

  // 원본 initDashboard() 로직
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchMeals();
        setAllMealData(res);
      } catch (e) {
        console.warn("식단 데이터 로드 실패:", e);
      }
      // loadRatings
      try {
        const r = await fetchRatings();
        setRatings(r);
        console.log("로드된 별점 데이터:", r);
      } catch (e) {
        console.warn("ratings 로드 실패:", e);
      }
    })();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("light-mode", isLightMode);
  }, [isLightMode]);

  const dateStr = toDateStr(currentViewDate);
  const mealsToday = allMealData[dateStr] || [];
  const score = ratings?.[dateStr]?.[currentMealType] ?? 0;

  const handlePrevMonth = useCallback(() => {
    setCurrentViewDate((d) => {
      const nd = new Date(d);
      nd.setMonth(nd.getMonth() - 1);
      return nd;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentViewDate((d) => {
      const nd = new Date(d);
      nd.setMonth(nd.getMonth() + 1);
      return nd;
    });
  }, []);

  // 날짜 클릭 시 조식으로 리셋 (원본 동일)
  const handleDateSelect = useCallback((date: Date) => {
    setCurrentViewDate(date);
    setCurrentMealType("조식");
  }, []);

  // 원본 confirmRating() 로직
  async function handleConfirmRating(s: number) {
    try {
      const result = await postRating(dateStr, currentMealType, s);
      if (result.ok) {
        setRatings((prev) => ({
          ...prev,
          [dateStr]: { ...(prev[dateStr] || {}), [currentMealType]: result.fin_score },
        }));
        showToast("별점이 저장되었습니다! ⭐");
        setRatingOpen(false);
      } else {
        throw new Error();
      }
    } catch {
      showToast("저장에 실패했습니다. 네트워크 상태를 확인해 주세요.", true);
      throw new Error("저장 실패");
    }
  }

  const m = String(currentViewDate.getMonth() + 1).padStart(2, "0");
  const d = String(currentViewDate.getDate()).padStart(2, "0");

  return (
    <>
      <div className="dashboard-container">
        {/* 달력 */}
        <Calendar
          viewDate={currentViewDate}
          onDateSelect={handleDateSelect}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />

        {/* 급식 상세 */}
        <MealDetail
          viewDate={currentViewDate}
          meals={mealsToday}
          mealType={currentMealType}
          score={score}
          onMealTypeChange={setCurrentMealType}
        />

        {/* 오른쪽 패널 */}
        <div className="right-panel">
          <div className="button-group">
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              title="테마 변경"
              className="flex items-center justify-center p-2 text-gray-400 transition-all duration-200 hover:text-white hover:scale-110 active:scale-95"
            >
              {isLightMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="action-btn" onClick={() => setRatingOpen(true)}>
              별점 남기기
            </button>
            <button className="action-btn" onClick={() => setNotSupportedOpen(true)}>
              급식 신청
            </button>
            <button className="action-btn" onClick={() => setNotSupportedOpen(true)}>
              로그인
            </button>
          </div>

          <WeeklyPanel
            viewDate={currentViewDate}
            allMealData={allMealData}
            weeklyMealType={currentWeeklyMealType}
            onWeeklyMealTypeChange={setCurrentWeeklyMealType}
          />

          <ReviewPanel
            viewDate={currentViewDate}
            mealType={currentMealType}
            onToast={showToast}
          />
        </div>
      </div>

      {/* 별점 모달 */}
      <RatingModal
        isOpen={ratingOpen}
        title={`${m}월 ${d}일 별점`}
        subtitle={currentMealType}
        initialScore={score}
        onClose={() => setRatingOpen(false)}
        onConfirm={handleConfirmRating}
      />

      {/* 미지원 기능 오버레이 */}
      <div
        className="not-supported-overlay"
        id="notSupportedOverlay"
        style={{ display: notSupportedOpen ? "flex" : "none" }}
        onClick={(e) => { if (e.target === e.currentTarget) setNotSupportedOpen(false); }}
      >
        <div className="not-supported-card">
          <p>아직 서비스되지 않는 기능입니다.</p>
          <button onClick={() => setNotSupportedOpen(false)}>확인</button>
        </div>
      </div>

      {/* 토스트 — 원본과 동일한 구조 */}
      <div
        className={`toast-notification${toast.visible ? " show" : ""}${toast.isError ? " toast-error" : ""}`}
        id="toastNotification"
      >
        {toast.msg}
      </div>
    </>
  );
}
