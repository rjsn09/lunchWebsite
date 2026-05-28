import React, { useState, useEffect, useCallback } from "react";
import Calendar from "./components/Calendar";
import MealDetail from "./components/MealDetail";
import WeeklyPanel from "./components/WeeklyPanel";
import RatingModal from "./components/RatingModal";
import ReviewPanel from "./components/ReviewPanel";
import LoginModal from "./components/LoginModal";
import { useToast } from "./components/useToast";
import { fetchMeals, fetchRatings, postRating } from "./api";
import type { MealData, MealType, RatingsData } from "./types";
import { Sun, Moon, LogIn, LogOut, User } from "lucide-react";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// ─── 로그인 상태 타입 ────────────────────────────────────────
interface AuthState {
  loggedIn: boolean;
  username: string;
  token: string;
}

const AUTH_KEY = "inmago_auth";

function loadAuth(): AuthState {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { loggedIn: false, username: "", token: "" };
}

function saveAuth(auth: AuthState) {
  if (auth.loggedIn) sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  else sessionStorage.removeItem(AUTH_KEY);
}

// ─── App ────────────────────────────────────────────────────
export default function App() {
  const [allMealData, setAllMealData] = useState<MealData>({});
  const [ratings, setRatings] = useState<RatingsData>({});
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
  const [currentMealType, setCurrentMealType] = useState<MealType>("조식");
  const [currentWeeklyMealType, setCurrentWeeklyMealType] = useState<MealType>("조식");
  const [isLightMode, setIsLightMode] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [notSupportedOpen, setNotSupportedOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>(loadAuth);
  const { toast, showToast } = useToast();

  // ── 식단 & 별점 로드 ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchMeals();
        setAllMealData(res);
      } catch (e) {
        console.warn("식단 데이터 로드 실패:", e);
      }
      try {
        const r = await fetchRatings();
        setRatings(r);
      } catch (e) {
        console.warn("ratings 로드 실패:", e);
      }
    })();
  }, []);

  // ── 테마 ──────────────────────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle("light-mode", isLightMode);
  }, [isLightMode]);

  // ── 유도 데이터 ───────────────────────────────────────────
  const dateStr = toDateStr(currentViewDate);
  const mealsToday = allMealData[dateStr] || [];
  const score = ratings?.[dateStr]?.[currentMealType] ?? 0;
  const m = String(currentViewDate.getMonth() + 1).padStart(2, "0");
  const d = String(currentViewDate.getDate()).padStart(2, "0");

  // ── 핸들러 ────────────────────────────────────────────────
  const handlePrevMonth = useCallback(() => {
    setCurrentViewDate((prev) => {
      const nd = new Date(prev);
      nd.setMonth(nd.getMonth() - 1);
      return nd;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentViewDate((prev) => {
      const nd = new Date(prev);
      nd.setMonth(nd.getMonth() + 1);
      return nd;
    });
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setCurrentViewDate(date);
    setCurrentMealType("조식");
  }, []);

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

  // ── 로그인/로그아웃 ───────────────────────────────────────
  function handleLoginSuccess(username: string, token: string) {
    const next: AuthState = { loggedIn: true, username, token };
    setAuth(next);
    saveAuth(next);
  }

  function handleLogout() {
    setAuth({ loggedIn: false, username: "", token: "" });
    saveAuth({ loggedIn: false, username: "", token: "" });
    showToast("로그아웃 되었습니다.");
  }

  // ─────────────────────────────────────────────────────────
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

            {/* 테마 토글 */}
            <button
              className="action-btn flex items-center justify-center"
              onClick={() => setIsLightMode(!isLightMode)}
              title="테마 변경"
              style={{ padding: '8px', minWidth: 'auto' }} 
            >
              {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* 별점 */}
            <button className="action-btn" onClick={() => setRatingOpen(true)}>
              별점 남기기
            </button>

            {/* 급식 신청 */}
            <button className="action-btn" onClick={() => setNotSupportedOpen(true)}>
              급식 신청
            </button>

            {/* 로그인 / 사용자 정보 + 로그아웃 */}
            {auth.loggedIn ? (
              <div className="auth-user-row">
                <span className="auth-username">
                  <User size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {auth.username}
                </span>
                <button className="auth-logout-btn" onClick={handleLogout} title="로그아웃">
                  <LogOut size={14} />
                  <span>로그아웃</span>
                </button>
              </div>
            ) : (
              <button className="action-btn auth-login-btn" onClick={() => setLoginOpen(true)}>
                <LogIn size={14} style={{ marginRight: 5, verticalAlign: "middle" }} />
                로그인
              </button>
            )}
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
            username={auth.loggedIn ? auth.username : ""}
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

      {/* 로그인 모달 */}
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onToast={showToast}
      />

      {/* 미지원 기능 오버레이 */}
      <div
        className="not-supported-overlay"
        style={{ display: notSupportedOpen ? "flex" : "none" }}
        onClick={(e) => { if (e.target === e.currentTarget) setNotSupportedOpen(false); }}
      >
        <div className="not-supported-card">
          <p>아직 서비스되지 않는 기능입니다.</p>
          <button onClick={() => setNotSupportedOpen(false)}>확인</button>
        </div>
      </div>

      {/* 토스트 */}
      <div
        className={`toast-notification${toast.visible ? " show" : ""}${toast.isError ? " toast-error" : ""}`}
      >
        {toast.msg}
      </div>
    </>
  );
}