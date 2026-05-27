"""
인마고 급식 게시판 - FastAPI 백엔드
Vercel Serverless Functions 배포용 (api/index.py)
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── 앱 초기화 ──────────────────────────────────────────────
app = FastAPI(title="인마고 급식 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 상수 ───────────────────────────────────────────────────
NEIS_API_KEY = os.getenv("NEIS_API_KEY", "")
SCHOOL_CODE = "J100005318"       # 인천전자마이스터고
OFFICE_CODE = "J10"              # 인천광역시교육청
NEIS_URL    = "https://open.neis.go.kr/hub/mealServiceDietInfo"

MEAL_TYPE_MAP = {"1": "조식", "2": "중식", "3": "석식"}

# 별점 인메모리 저장소 (실제 운영시 DB로 교체)
# 구조: { "20260507": { "조식": {"total": 4.5, "count": 2} } }
_ratings_store: dict[str, dict[str, dict[str, float]]] = {}

# ── 유틸 ───────────────────────────────────────────────────

def _get_week_range(base: date) -> tuple[str, str]:
    """기준 날짜가 속한 주의 월~금 범위 반환 (YYYYMMDD 문자열)"""
    weekday = base.weekday()
    monday  = base - timedelta(days=weekday)
    friday  = monday + timedelta(days=4)
    return monday.strftime("%Y%m%d"), friday.strftime("%Y%m%d")


def _parse_dish_name(raw: str) -> list[str]:
    """DDISH_NM 문자열을 <br/> 또는 줄바꿈으로 분리하여 리스트 반환"""
    import re
    items = re.split(r"<br\s*/?>|\n", raw)
    return [i.strip() for i in items if i.strip()]


async def _fetch_neis_meals(from_date: str, to_date: str) -> list[dict[str, Any]]:
    """NEIS API 호출 — 날짜 범위의 식단 데이터를 반환"""
    params = {
        "KEY":        NEIS_API_KEY,
        "Type":       "json",
        "pIndex":     "1",
        "pSize":      "100",
        "ATPT_OFCDC_SC_CODE": OFFICE_CODE,
        "SD_SCHUL_CODE":      SCHOOL_CODE,
        "MLSV_FROM_YMD":      from_date,
        "MLSV_TO_YMD":        to_date,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(NEIS_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    rows: list[dict[str, Any]] = []
    try:
        rows = data["mealServiceDietInfo"][1]["row"]
    except (KeyError, IndexError, TypeError):
        pass
    return rows


def _rows_to_meal_data(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """NEIS 행 목록을 { "YYYYMMDD": [meal, ...] } 형태로 변환"""
    result: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        date_key  = row.get("MLSV_YMD", "")
        meal_code = row.get("MMEAL_SC_CODE", "")
        meal_name = MEAL_TYPE_MAP.get(meal_code, meal_code)
        entry = {
            "MMEAL_SC_NM": meal_name,
            "DDISH_NM":    _parse_dish_name(row.get("DDISH_NM", "")),
            "CAL_INFO":    row.get("CAL_INFO", ""),
            "IMG_PATH":    row.get("ORPLC_INFO", ""),   # 식재료 원산지 (사진 없음)
        }
        result.setdefault(date_key, []).append(entry)
    return result


# ── 라우터 ─────────────────────────────────────────────────

@app.get("/api/meals")
async def get_meals() -> JSONResponse:
    """
    이번 주 (±2주) 식단 데이터를 반환합니다.
    NEIS_API_KEY 미설정 시 빈 객체를 반환합니다.
    """
    if not NEIS_API_KEY:
        return JSONResponse({})

    today = date.today()
    # 이전 주 ~ 다음 주 3주치 fetch
    all_data: dict[str, list[dict[str, Any]]] = {}
    for delta in [-7, 0, 7]:
        base = today + timedelta(days=delta)
        from_d, to_d = _get_week_range(base)
        try:
            rows = await _fetch_neis_meals(from_d, to_d)
            all_data.update(_rows_to_meal_data(rows))
        except Exception:
            pass  # 일부 주 실패해도 나머지 반환

    return JSONResponse(all_data)


@app.get("/api/ratings")
async def get_ratings() -> JSONResponse:
    """
    저장된 모든 별점 평균을 반환합니다.
    구조: { "YYYYMMDD": { "조식": 4.5, "중식": 3.0 } }
    """
    result: dict[str, dict[str, float]] = {}
    for date_key, meals in _ratings_store.items():
        result[date_key] = {}
        for meal_type, data in meals.items():
            count = data.get("count", 0)
            total = data.get("total", 0.0)
            result[date_key][meal_type] = round(total / count, 1) if count else 0.0
    return JSONResponse(result)


class RatingRequest(BaseModel):
    date_str: str   # "YYYYMMDD"
    meal_type: str  # "조식" | "중식" | "석식"
    score: float    # 0.5 ~ 5.0


@app.post("/api/ratings")
async def post_rating(body: RatingRequest) -> JSONResponse:
    """별점을 저장하고 현재 평균 별점을 반환합니다."""
    if not (0.5 <= body.score <= 5.0):
        raise HTTPException(status_code=400, detail="score must be between 0.5 and 5.0")

    store = _ratings_store.setdefault(body.date_str, {})
    entry = store.setdefault(body.meal_type, {"total": 0.0, "count": 0})
    entry["total"] += body.score
    entry["count"] += 1
    fin_score = round(entry["total"] / entry["count"], 1)

    return JSONResponse({"ok": True, "fin_score": fin_score})


# ── 로컬 개발용 진입점 ─────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("index:app", host="0.0.0.0", port=8000, reload=True)
