import type { MealData, RatingsData, InquiryItem } from "./types";

export async function fetchMeals(): Promise<MealData> {
  const res = await fetch("/api/meals");
  if (!res.ok) throw new Error("식단 데이터 로드 실패");
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

export async function postInquiry(userId: string, subject: string, message: string) {
  const res = await fetch("/api/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, subject, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "문의 제출에 실패했습니다.");
  return data;
}

export async function fetchInquiries(adminUserId: string): Promise<InquiryItem[]> {
  const res = await fetch(`/api/inquiries?admin_user_id=${encodeURIComponent(adminUserId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "문의 목록을 불러오지 못했습니다.");
  return data;
}

export async function markInquiryRead(
  id: string | number,
  adminUserId: string,
  isRead: boolean
) {
  const res = await fetch(`/api/inquiries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_user_id: adminUserId, is_read: isRead }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "상태 변경에 실패했습니다.");
  return data;
}

export async function deleteInquiry(id: string | number, adminUserId: string) {
  const res = await fetch(
    `/api/inquiries/${id}?admin_user_id=${encodeURIComponent(adminUserId)}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "삭제에 실패했습니다.");
  return data;
}