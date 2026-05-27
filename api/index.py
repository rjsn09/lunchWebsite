import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Response
from pydantic import BaseModel
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        
        if res.status_code != 200:
            print(f"Supabase Error: {res.text}")
            raise HTTPException(status_code=res.status_code, detail=res.text)
            
        result = {}
        for row in res.json():
            date = row["date"]
            if date not in result:
                result[date] = {}
            result[date][row["MMEAL_SC_NM"]] = row["score"]
        return result

@app.get("/api/meals")
async def get_meals(response: Response):
    async with httpx.AsyncClient() as client:
        meal_task = client.get(f"{SUPABASE_URL}/rest/v1/meal_data", headers=get_sb_headers())
        dish_task = client.get(f"{SUPABASE_URL}/rest/v1/DDISH_NM", headers=get_sb_headers())
        meal_res, dish_res = await asyncio.gather(meal_task, dish_task)

        meal_rows = meal_res.json() if meal_res.status_code == 200 else []
        dish_rows = dish_res.json() if dish_res.status_code == 200 else []

        dish_map = {}
        for d in dish_rows:
            key = (d["date"], d["MMEAL_SC_NM"])
            if key not in dish_map:
                dish_map[key] = []
            dish_map[key].append(d["DDISH_NM"])

        result = {}
        for m in meal_rows:
            date = m["date"]
            m_type = m["MMEAL_SC_NM"]
            if date not in result:
                result[date] = []
            
            dishes = dish_map.get((date, m_type), [])
            
            result[date].append({
                "MMEAL_SC_NM": m_type,
                "DDISH_NM": dishes,
                "CAL_INFO": f"{m['CAL_INFO']} Kcal" if m.get('CAL_INFO') else None,
                "IMG_PATH": m.get("IMG_PATH")
            })
        response.headers["Cache-Control"] = "public, s-maxage=3600, stale-while-revalidate=60"
        return result

class RatingPayload(BaseModel):
    date_str: str
    meal_type: str
    score: float

@app.post("/api/ratings")
async def post_rating(payload: RatingPayload):
    async with httpx.AsyncClient() as client:
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

        rating_times = existing["rating_times"] if existing else 0
        total = existing["total"] if existing else 0.0
        new_times = rating_times + 1
        new_total = total + payload.score
        fin_score = round(new_total / new_times, 1)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("index:app", host="0.0.0.0", port=8000, reload=True)
