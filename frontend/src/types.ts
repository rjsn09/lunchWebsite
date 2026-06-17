export interface Meal {
  MMEAL_SC_NM: string;   // "조식" | "중식" | "석식"
  DDISH_NM: string[];    // 반찬 목록
  CAL_INFO: string;      // 칼로리 정보
  IMG_PATH?: string;     // 사진 URL
}

export type MealData = Record<string, Meal[]>; // { "20260507": [...] }

export type RatingsData = Record<string, Record<string, number>>; // { "20260507": { "조식": 4.5 } }

export type MealType = "조식" | "중식" | "석식";

export interface ReviewItem {
  id: string | number;
  text: string;
  time: string;
  author: string;
}

export interface InquiryItem {
  id: string | number;
  user_id: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
}