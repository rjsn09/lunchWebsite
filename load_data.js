// load_data.js
import fs from 'fs';
import path from 'path';
import * as mealUtils from './download_meals.js';

const configPath = path.resolve('data/config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

async function fetchMealData() {
    const API_URL = "https://open.neis.go.kr/hub/mealServiceDietInfo";

    const AUTH_KEY = config.OpenApiKey;

    const params = new URLSearchParams({
        // [기본 인자]
        KEY: AUTH_KEY,             // 인증키 (필수)
        Type: "json",              // 호출 문서 타입 (필수)
        pIndex: "1",               // 페이지 위치 (필수)
        pSize: "1000",              // 페이지 당 신청 숫자 (필수 - 한 달치 넉넉히 100)

        // [신청 인자]
        ATPT_OFCDC_SC_CODE: "E10", // 시도교육청코드
        SD_SCHUL_CODE: "7310370",   // 행정표준코드 (인천전자마이스터고)
        MLSV_FROM_YMD: "20260330", // 급식시작일자
        MLSV_TO_YMD: "20260830"    // 급식종료일자
    });

    const fullUrl = `${API_URL}?${params.toString()}`;
    console.log(fullUrl);

    try {
        console.log("[INFO] 명세서 규격에 맞춰 데이터를 요청합니다...");
        const response = await fetch(fullUrl);
        const data = await response.json();

        // 에러 체크 (명세서의 RESULT 코드 기준)
        if (data.RESULT && data.RESULT.CODE !== "INFO-000") {
            console.error(`[ERROR] 서버 응답 에러: ${data.RESULT.MESSAGE} (${data.RESULT.CODE})`);
            return;
        }
        const mealdata = {};
        await mealUtils.initSession();  // 세션 초기화

        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1]) {
            for (const row of data.mealServiceDietInfo[1].row) {
                const date = row.MLSV_YMD;

                if (!mealdata[date]) {
                    mealdata[date] = [];
                }

                // NEIS 기준 메뉴 (기본값/폴백용)
                const neisMenu = (row.DDISH_NM || "")
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/\([0-9.\s]+\)/g, "")
                    .replace(/[*#]/g, "")
                    .split("\n")
                    .map(item => item.trim())
                    .filter(item => item !== "");

                // 학교 홈페이지에서 이미지 + 메뉴 함께 스크래핑
                const detail = await mealUtils.getMealDetail(
                    date.slice(0, 4),
                    date.slice(4, 6),
                    date.slice(6, 8),
                    row.MMEAL_SC_NM
                );

                // 스크래핑한 메뉴가 있으면 그걸 우선 사용, 없으면 NEIS 메뉴로 폴백
                const finalMenu = detail.menu.length > 0 ? detail.menu : neisMenu;

                if (detail.menu.length === 0) {
                    console.warn(`[WARN] ${date} ${row.MMEAL_SC_NM}: 사이트에서 메뉴를 찾지 못해 NEIS 데이터로 대체합니다.`);
                }

                mealdata[date].push({
                    "MMEAL_SC_NM": row.MMEAL_SC_NM,
                    "DDISH_NM": finalMenu,
                    "CAL_INFO": row.CAL_INFO,
                    "IMG_PATH": detail.imgUrl
                });
            }
        }

        // 데이터 저장
        if (data.mealServiceDietInfo) {
            fs.writeFileSync('data/data/meal_data.json', JSON.stringify(mealdata, null, 2), 'utf-8');
            console.log("[INFO] meal_data.json 저장 완료!");
            console.log(`[INFO] 수집된 식단 수: ${data.mealServiceDietInfo[1].row.length}건`);
        }
    } catch (error) {
        console.error("[ERROR] 네트워크 에러:", error);
    }
}

fetchMealData();