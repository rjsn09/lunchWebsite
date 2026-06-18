import type { MealData, RatingsData, InquiryItem, ScheduleData } from "./types";

export async function fetchMeals(): Promise<MealData> {
  const res = await fetch("/api/meals");
  if (!res.ok) throw new Error("식단 데이터 로드 실패");
  return res.json();
}

// ── 학사일정 ──────────────────────────────────────────
export async function fetchSchedule(): Promise<ScheduleData> {
  const res = await fetch("/api/schedule");
  if (!res.ok) throw new Error("학사일정 데이터 로드 실패");
  return res.json();
}

export async function fetchRatings(): Promise<RatingsData> {
  const res = await fetch("/api/ratings");
  if (!res.ok) throw new Error("별점 데이터 로드 실패");
  return res.json();
}

export async function postRating(
  dateStr: string,
  mealType: string,
  score: number
): Promise<{ ok: boolean; fin_score: number }> {
  const res = await fetch("/api/ratings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date_str: dateStr, meal_type: mealType, score }),
  });
  if (!res.ok) throw new Error("별점 저장 실패");
  return res.json();
}

// ── 문의하기 ──────────────────────────────────────────
export async function postInquiry(
  userId: string,
  subject: string,
  message: string
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch("/api/inquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, subject, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "문의 제출 실패");
  return data;
}

// ── 관리자: 문의 목록 ─────────────────────────────────
export async function fetchInquiries(adminUserId: string): Promise<InquiryItem[]> {
  const res = await fetch(`/api/admin/inquiries?admin_user_id=${encodeURIComponent(adminUserId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "문의 목록 로드 실패");
  return data;
}

// ── 관리자: 리뷰 수정 ─────────────────────────────────
export async function adminEditReview(
  reviewId: string | number,
  newText: string,
  adminUserId: string
): Promise<{ ok: boolean }> {
  const res = await fetch("/api/admin/reviews", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ review_id: reviewId, new_text: newText, admin_user_id: adminUserId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "수정 실패");
  return data;
}

// ── 관리자: 리뷰 삭제 ─────────────────────────────────
export async function adminDeleteReview(
  reviewId: string | number,
  adminUserId: string
): Promise<{ ok: boolean }> {
  const res = await fetch("/api/admin/reviews", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ review_id: reviewId, admin_user_id: adminUserId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "삭제 실패");
  return data;
}