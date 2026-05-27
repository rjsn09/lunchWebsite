import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mangum import Mangum

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# os.environ 대신 os.getenv를 사용하면 환경변수가 없을 때 프로그램이 바로 튕기는 것을 막아줍니다.
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")

def sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

def cal_fin_score(rating_times, total_score):
    if rating_times == 0:
        return 0
    fin_score = round(total_score / rating_times, 1)
    decimal = fin_score - int(fin_score)
    if decimal >= 0.75:
        return int(fin_score) + 1
    elif decimal >= 0.25:
        return float(int(fin_score) + 0.5)
    else:
        return int(fin_score)

@app.get("/")
async def read_root():
    return {"status": "Backend is running. Please access via index.html"}

@app.get("/ratings")
@app.get("/api/ratings")
async def get_ratings():
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/ratings",
            headers=sb_headers(),
            params={"select": "date,MMEAL_SC_NM,score,rating_times,total"},
        )
    res.raise_for_status()
    
    result = {}
    for row in res.json():
        if row["date"] not in result:
            result[row["date"]] = {}
            
        # 🚨 중요: HTML 프론트엔드가 배열이 아닌 '숫자'를 기대하므로 score만 넘겨주도록 수정!
        result[row["date"]][row["MMEAL_SC_NM"]] = row["score"]
        
    return result

class RatingPayload(BaseModel):
    date_str: str
    meal_type: str
    score: float

@app.post("/ratings")
@app.post("/api/ratings")
async def post_rating(payload: RatingPayload):
    async with httpx.AsyncClient() as client:
        # 기존 행 조회
        get_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/ratings",
            headers=sb_headers(),
            params={
                "select": "id,rating_times,total",
                "date": f"eq.{payload.date_str}",
                "MMEAL_SC_NM": f"eq.{payload.meal_type}",
            },
        )
        get_res.raise_for_status()
        rows = get_res.json()
        existing = rows[0] if rows else None

        rating_times = existing["rating_times"] if existing else 0
        total        = existing["total"]        if existing else 0.0
        new_times    = rating_times + 1
        new_total    = total + payload.score
        fin_score    = cal_fin_score(new_times, new_total)

        body = {
            "date": payload.date_str,
            "MMEAL_SC_NM": payload.meal_type,
            "score": fin_score,
            "rating_times": new_times,
            "total": new_total,
        }

        if existing:
            save_res = await client.patch(
                f"{SUPABASE_URL}/rest/v1/ratings",
                headers=sb_headers(),
                params={"id": f"eq.{existing['id']}"},
                json=body,
            )
        else:
            save_res = await client.post(
                f"{SUPABASE_URL}/rest/v1/ratings",
                headers=sb_headers(),
                json=body,
            )
        save_res.raise_for_status()

    return {"ok": True, "fin_score": fin_score, "rating_times": new_times, "total": new_total}

handler = Mangum(app)