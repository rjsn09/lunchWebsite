import fs from 'fs';
import path from 'path';
import * as mealUtils from './download_meals.js';

const configPath = path.resolve('data/config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// API 설정
const BASE_URL = "https://open.neis.go.kr/hub";
const AUTH_KEY = config.OpenApiKey;
const ATPT_OFCDC_SC_CODE = "E10";
const SD_SCHUL_CODE = "7310370";

async function fetchData(
    lunch_date=["20260601", "20260630"], 
    schedule_date=["20260601", "20260630"], 
    collect_lunch_data=true,
    collect_schecule_data=true
) {
    const LUNCH_FROM_YMD = lunch_date[0];
    const LUNCH_TO_YMD = lunch_date[1];

    const SCHEDULE_FROM_YMD = schedule_date[0];
    const SCHEDULE_TO_YMD = schedule_date[1];

    if (collect_lunch_data) {
        await fetchMealData(LUNCH_FROM_YMD, LUNCH_TO_YMD);
    }
    if (collect_schecule_data) {
        await fetchScheduleData(SCHEDULE_FROM_YMD, SCHEDULE_TO_YMD);
    }
}

async function fetchMealData(from, to) {
    const url = `${BASE_URL}/mealServiceDietInfo?KEY=${AUTH_KEY}&Type=json&pIndex=1&pSize=1000&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_FROM_YMD=${from}&MLSV_TO_YMD=${to}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.mealServiceDietInfo) {
        const mealdata = {};
        await mealUtils.initSession();

        for (const row of data.mealServiceDietInfo[1].row) {
            const date = row.MLSV_YMD;
            if (!mealdata[date]) mealdata[date] = [];
            
            const detail = await mealUtils.getMealDetail(date.slice(0, 4), date.slice(4, 6), date.slice(6, 8), row.MMEAL_SC_NM);
            
            mealdata[date].push({
                "MMEAL_SC_NM": row.MMEAL_SC_NM,
                "DDISH_NM": detail.menu.length > 0 ? detail.menu : row.DDISH_NM.replace(/<[^>]*>/g, "").split("\n"),
                "CAL_INFO": row.CAL_INFO,
                "IMG_PATH": detail.imgUrl
            });
        }
        fs.writeFileSync('data/data/meal_data.json', JSON.stringify(mealdata, null, 2), 'utf-8');
        console.log("[INFO] meal_data.json 저장 완료!");
    }
}

async function fetchScheduleData(from, to) {
    const url = `${BASE_URL}/SchoolSchedule?KEY=${AUTH_KEY}&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&AA_FROM_YMD=${from}&AA_TO_YMD=${to}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.SchoolSchedule) {
        const scheduleMap = {};
        
        for (const row of data.SchoolSchedule[1].row) {
            const date = row.AA_YMD;
            const eventName = row.EVENT_NM;

            scheduleMap[date] = eventName;
        }

        fs.writeFileSync('data/data/school_schedule.json', JSON.stringify(scheduleMap, null, 2), 'utf-8');
        console.log("[INFO] school_schedule.json 저장 완료!");
    }
}

fetchData(["20260601", "20260630"], ["20260601", "20271231"], false, true);