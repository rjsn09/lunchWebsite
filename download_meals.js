// download_meals.js
import * as cheerio from "cheerio";
import fs from "fs";

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
 * NEIS DDISH_NM 정제 로직과 동일한 방식으로 텍스트를 정리한다.
 * - <br> → 줄바꿈
 * - 알레르기 표시 괄호 "(5.6.16)" 등 제거
 * - "*", "#" 같은 강조 기호 제거
 * - 빈 줄 제거
 */
function cleanMenuText(raw) {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\([0-9.\s]+\)/g, "")
    .replace(/[*#★]/g, "")
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s !== "");
}

/**
 * 상세 페이지(POST 응답 HTML)에서 메뉴 목록을 추출한다.
 *
 * 실제 구조 (2026-06 기준 확인됨):
 *   <table id="foodTable">
 *     <tr><th><strong>칼로리</strong></th><td>865.1Kcal</td></tr>
 *     <tr><th><strong>메뉴</strong>[중식]</th><td><div>밥 <br/>국1 (5.6)<br/>...</div></td></tr>
 *     <tr><th><strong>이미지</strong></th><td>...</td></tr>
 *     ...
 *   </table>
 *
 * "메뉴"가 포함된 th를 가진 행을 찾아 그 옆 td > div 안의 <br> 구분 텍스트를 추출한다.
 *
 * @param {import('cheerio').CheerioAPI} $
 * @returns {string[]} 정제된 메뉴 항목 배열
 */
function extractMenu($) {
  let menu = [];

  $("#foodTable tr").each((_, tr) => {
    const thText = $(tr).find("th strong").first().text().trim();
    if (thText.includes("메뉴")) {
      const div = $(tr).find("td div").first();
      const html = div.length > 0 ? div.html() : $(tr).find("td").first().html();
      menu = cleanMenuText(html ?? "");
    }
  });

  return menu;
}

/**
 * "칼로리" 행 텍스트 추출 (예: "865.1Kcal"). 필요 시 NEIS CAL_INFO 대신/보조로 사용 가능.
 * @param {import('cheerio').CheerioAPI} $
 * @returns {string|null}
 */
function extractCalorie($) {
  let cal = null;
  $("#foodTable tr").each((_, tr) => {
    const thText = $(tr).find("th strong").first().text().trim();
    if (thText.includes("칼로리")) {
      cal = $(tr).find("td").first().text().trim();
    }
  });
  return cal;
}

/**
 * 급식 상세 정보(이미지 URL + 메뉴 목록) 반환
 * @param {string} year  - 연도 (예: "2026")
 * @param {string} month - 월, 두 자리 (예: "05")
 * @param {number|string} day - 일 (예: 7 또는 "07")
 * @param {string} meal  - "조식" | "중식" | "석식"
 * @param {object} [opts]
 * @param {boolean} [opts.debug] - true면 받은 HTML을 /tmp 에 저장 (셀렉터 점검용)
 * @returns {Promise<{ imgUrl: string|null, menu: string[], calorie: string|null }>}
 */
export async function getMealDetail(year, month, day, meal, opts = {}) {
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

  console.log(`[${year}-${month}-${String(day).padStart(2, "0")} ${meal}] status: ${res.status}`);
  if (!res.ok) return { imgUrl: null, menu: [], calorie: null };

  const html = await res.text();

  // 디버그: 셀렉터가 안 맞을 때 실제 응답 HTML을 확인하기 위함
  if (opts.debug) {
    const debugPath = `/tmp/meal_detail_${year}${month}${String(day).padStart(2, "0")}_${typeStr}.html`;
    fs.writeFileSync(debugPath, html, "utf-8");
    console.log(`[DEBUG] 응답 HTML 저장됨: ${debugPath}`);
  }

  const $ = cheerio.load(html);

  // 이미지 추출 (기존 로직 그대로)
  const imgEl = $("img").filter((_, el) =>
    $(el).attr("src")?.includes("/upload/foodlist/")
  ).first();
  const imgSrc = imgEl.attr("src");
  const imgUrl = imgSrc ? (imgSrc.startsWith("http") ? imgSrc : `${BASE_DOMAIN}${imgSrc}`) : null;

  // 메뉴 & 칼로리 추출
  const menu = extractMenu($);
  const calorie = extractCalorie($);

  return { imgUrl, menu, calorie };
}

/**
 * 기존 호출부와의 호환을 위해 이미지 URL만 반환하는 래퍼.
 * (load_data.js를 굳이 안 바꿔도 동작하게 하려면 이걸 그대로 써도 됨)
 */
export async function getMealImageUrl(year, month, day, meal) {
  const { imgUrl } = await getMealDetail(year, month, day, meal);
  return imgUrl;
}

// 테스트 — opts.debug:true 로 실제 응답 HTML을 /tmp 에 저장해 점검할 수도 있음
if (import.meta.url === `file://${process.argv[1]}`) {
  await initSession();
  const result = await getMealDetail("2026", "06", "1", "중식");
  console.log("결과:", result);
}