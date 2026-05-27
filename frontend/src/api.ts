import type { MealData, RatingsData } from "./types";

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
): Promise<{ fin_score: number }> {
  const res = await fetch("/api/ratings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date_str: dateStr, meal_type: mealType, score }),
  });
  if (!res.ok) throw new Error("별점 저장 실패");
  return res.json();
}
