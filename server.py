import json
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

RATINGS_PATH = "src/Data/ratings.json"

def read_ratings() -> dict:
    if not os.path.exists(RATINGS_PATH):
        return {}
    try:
        with open(RATINGS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def write_ratings(data: dict):
    os.makedirs(os.path.dirname(RATINGS_PATH), exist_ok=True)
    with open(RATINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def cal_fin_score(rating_times, total_score):
    if rating_times == 0:
        return 0
    fin_score = round(total_score / rating_times, 1)
    decimal = fin_score - int(fin_score)
    if decimal >= 0.75:
        return int(fin_score) + 1
    elif decimal >= 0.25:
        return int(fin_score) + 0.5
    else:
        return int(fin_score)

# ── API ──
@app.get("/api/ratings")
def get_ratings():
    return read_ratings()

class RatingPayload(BaseModel):
    date_str: str
    meal_type: str
    score: float

@app.post("/api/ratings")
def post_rating(payload: RatingPayload):
    data = read_ratings()
    current_data = data.get(payload.date_str, {})
    meal_data = current_data.get(payload.meal_type, [0, 0, 0])
    cur_score, rating_times, total = meal_data if len(meal_data) == 3 else [0, 0, 0]

    new_total = total + payload.score
    new_times = rating_times + 1
    fin_score = cal_fin_score(new_times, new_total)

    if payload.date_str not in data:
        data[payload.date_str] = {}
    data[payload.date_str][payload.meal_type] = [fin_score, new_times, new_total]
    write_ratings(data)
    return {"ok": True}

# ── 정적 파일 설정 ──
if os.path.exists("src"):
    app.mount("/src", StaticFiles(directory="src"), name="src")

@app.get("/")
def root():
    return FileResponse("index.html")

if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
    # uvicorn server:app