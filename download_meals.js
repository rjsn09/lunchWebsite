// download_meals.js
import * as cheerio from "cheerio";

const BASE_DOMAIN = "https://intec.icehs.kr";
const LIST_URL = `${BASE_DOMAIN}/foodlist.do?m=060406&s=intec`;

const FOOD_TYPE_MAP = {
  조식: { foodType: "B", typeStr: "breakfast" },
  중식: { foodType: "L", typeStr: "lunch" },
  석식: { foodType: "D", typeStr: "dinner" },
};

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Referer": LIST_URL,
};

// 쿠키 저장용
let cookie = "";

// 세션 초기화 (최초 1회만 호출)
export async function initSession() {
  const res = await fetch(LIST_URL, { headers });
  cookie = res.headers.get("set-cookie") ?? "";
  console.log("세션 초기화 완료, 쿠키:", cookie.slice(0, 60));
}

/**
 * 급식 사진 URL 반환
 * @param {string} year  - 연도 (예: "2026")
 * @param {string} month - 월, 두 자리 (예: "05")
 * @param {number|string} day - 일 (예: 7 또는 "07")
 * @param {string} meal  - "조식" | "중식" | "석식"
 * @returns {Promise<string|null>} 이미지 URL, 없으면 null
 */
export async function getMealImageUrl(year, month, day, meal) {
  if (!FOOD_TYPE_MAP[meal]) {
    throw new Error(`meal은 '조식', '중식', '석식' 중 하나여야 합니다.`);
  }

  const { foodType, typeStr } = FOOD_TYPE_MAP[meal];
  const url = `${BASE_DOMAIN}/intec/food/${year}/${month}/${parseInt(day)}/${typeStr}.do`;

  const formData = new FormData();
  formData.append("year", year);
  formData.append("month", month);
  formData.append("day", String(parseInt(day)));
  formData.append("foodType", foodType);
  formData.append("delm", "");
  formData.append("type", typeStr);
  formData.append("selType", "A");
  formData.append("srhYear", year);
  formData.append("srhMonth", String(parseInt(month)));

  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers, Cookie: cookie },
    body: formData,
  });

  console.log(`[${year}-${month}-${String(day).padStart(2,"0")} ${meal}] status: ${res.status}`);
  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const imgSrc = $("img").filter((_, el) =>
    $(el).attr("src")?.includes("/upload/foodlist/")
  ).first().attr("src");

  if (!imgSrc) return null;
  return imgSrc.startsWith("http") ? imgSrc : `${BASE_DOMAIN}${imgSrc}`;
}

// 테스트
await initSession();
const result = await getMealImageUrl("2026", "05", "12", "중식");
console.log("결과:", result);