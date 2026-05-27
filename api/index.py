import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# .strip()을 추가하여 혹시 모를 앞뒤 공백(엔터, 스페이스)을 완전히 제거합니다.
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()

def get_sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }

@app.get("/api/ratings")
async def get_ratings():
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/ratings",
            headers=get_sb_headers(),
            params={"select": "date,MMEAL_SC_NM,score,rating_times,total"},
        )
        
        # 만약 에러가 나면, Supabase가 보내온 진짜 에러 메시지를 로그에 찍습니다.
        if res.status_code != 200:
            print(f"Supabase Error Detail: {res.text}") # Vercel Logs에서 확인 가능
            raise HTTPException(status_code=res.status_code, detail=res.text)
            
        result = {}
        for row in res.json():
            date = row["date"]
            if date not in result:
                result[date] = {}
            result[date][row["MMEAL_SC_NM"]] = row["score"]
        return result

class RatingPayload(BaseModel):
    date_str: str
    meal_type: str
    score: float

@app.post("/api/ratings")
async def post_rating(payload: RatingPayload):
    async with httpx.AsyncClient() as client:
        # 1. 기존 데이터 조회
        get_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/ratings",
            headers=get_sb_headers(),
            params={
                "select": "id,rating_times,total",
                "date": f"eq.{payload.date_str}",
                "MMEAL_SC_NM": f"eq.{payload.meal_type}",
            },
        )
        if get_res.status_code != 200:
            raise HTTPException(status_code=get_res.status_code, detail=get_res.text)
            
        rows = get_res.json()
        existing = rows[0] if rows else None

        # 2. 점수 계산 로직 (기존과 동일)
        rating_times = existing["rating_times"] if existing else 0
        total = existing["total"] if existing else 0.0
        new_times = rating_times + 1
        new_total = total + payload.score
        
        # 간단한 반올림 계산
        fin_score = round(new_total / new_times, 1)

        body = {
            "date": payload.date_str,
            "MMEAL_SC_NM": payload.meal_type,
            "score": fin_score,
            "rating_times": new_times,
            "total": new_total,
        }

        # 3. 데이터 저장
        if existing:
            save_res = await client.patch(
                f"{SUPABASE_URL}/rest/v1/ratings",
                headers={**get_sb_headers(), "Prefer": "return=representation"},
                params={"id": f"eq.{existing['id']}"},
                json=body,
            )
        else:
            save_res = await client.post(
                f"{SUPABASE_URL}/rest/v1/ratings",
                headers={**get_sb_headers(), "Prefer": "return=representation"},
                json=body,
            )
        
        if save_res.status_code not in [200, 201]:
            raise HTTPException(status_code=save_res.status_code, detail=save_res.text)

        return {"ok": True, "fin_score": fin_score}