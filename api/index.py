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

# ──────────────────────────────────────────────────────
# 기존 엔드포인트
# ──────────────────────────────────────────────────────

@app.get("/api/ratings")
async def get_ratings():
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/ratings",
            headers=get_sb_headers(),
            params={"select": "date,MMEAL_SC_NM,score,rating_times,total"},
        )
        if res.status_code != 200:
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
                "CAL_INFO": f"{m['CAL_INFO']} Kcal" if m.get("CAL_INFO") else None,
                "IMG_PATH": m.get("IMG_PATH"),
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


# ──────────────────────────────────────────────────────
# 회원 관련
# ──────────────────────────────────────────────────────

class RegisterPayload(BaseModel):
    user_id: str
    password: str

@app.post("/api/register")
async def post_register(payload: RegisterPayload):
    async with httpx.AsyncClient() as client:
        check_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=get_sb_headers(),
            params={"user_id": f"eq.{payload.user_id}"},
        )
        if check_res.status_code == 200 and len(check_res.json()) > 0:
            raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")

        insert_res = await client.post(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=get_sb_headers(),
            json={"user_id": payload.user_id, "password": payload.password},
        )
        if insert_res.status_code not in [200, 201]:
            raise HTTPException(status_code=insert_res.status_code, detail=insert_res.text)

        return {"ok": True, "message": "회원가입이 완료되었습니다."}


class LoginPayload(BaseModel):
    user_id: str
    password: str

@app.post("/api/login")
async def post_login(payload: LoginPayload):
    async with httpx.AsyncClient() as client:
        get_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=get_sb_headers(),
            params={
                "select": "user_id,password",
                "user_id": f"eq.{payload.user_id}",
                "password": f"eq.{payload.password}",
            },
        )
        if get_res.status_code != 200:
            raise HTTPException(status_code=get_res.status_code, detail=get_res.text)

        rows = get_res.json()
        existing = rows[0] if rows else None

        if not existing:
            raise HTTPException(status_code=404, detail="존재하지 않는 아이디입니다.")
        if existing["password"] != payload.password:
            raise HTTPException(status_code=401, detail="비밀번호가 틀렸습니다.")

        return {"ok": True, "user_id": existing["user_id"]}


# ──────────────────────────────────────────────────────
# 리뷰
# ──────────────────────────────────────────────────────

@app.get("/api/reviews")
async def get_reviews(date: str, meal_type: str):
    """
    GET /api/reviews?date=20250528&meal_type=조식
    Supabase reviews 테이블: id, date, meal_type, user_id, text, created_at
    """
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/reviews",
            headers=get_sb_headers(),
            params={
                "select": "id,user_id,text,created_at",
                "date": f"eq.{date}",
                "meal_type": f"eq.{meal_type}",
                "order": "created_at.desc",
            },
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)

        return [
            {
                "id": r["id"],
                "author": r["user_id"],
                "text": r["text"],
                "time": r["created_at"][11:16] if r.get("created_at") else "",
            }
            for r in res.json()
        ]


# ──────────────────────────────────────────────────────
# 욕설 필터
# ──────────────────────────────────────────────────────

BANNED_WORDS: list[str] = [
    # 비속어·욕설 (초성/변형 포함 주요 패턴)
    "씨발", "시발", "ㅅㅂ", "씨바", "씨팔", "시팔",
    "개새끼", "개새", "ㄱㅅㄲ", "개쉐끼",
    "존나", "존내", "ㅈㄴ",
    "병신", "ㅂㅅ", "븅신",
    "미친놈", "미친년", "미친새끼", "미친",
    "새끼", "쌔끼", "ㅅㄲ",
    "년", "놈",
    "지랄", "ㅈㄹ",
    "개소리", "개같",
    "꺼져", "뒤져", "뒤지",
    "보지", "자지", "보짓", "자짓",
    "창녀", "창놈", "갈보",
    "찐따", "찐찐", "장애",
    "한남", "한녀", "페미",   # 혐오 표현
    "wtf", "fuck", "shit", "bitch", "asshole", "bastard",
]

def contains_banned(text: str) -> str | None:
    """욕설 포함 여부 확인. 포함 시 해당 단어 반환, 없으면 None."""
    lower = text.lower().replace(" ", "")
    for word in BANNED_WORDS:
        if word in lower:
            return word
    return None


class ReviewPayload(BaseModel):
    date: str
    meal_type: str
    user_id: str   # 비로그인 시 빈 문자열 → 서버에서 "익명"으로 처리
    text: str

@app.post("/api/reviews")
async def post_review(payload: ReviewPayload):
    """
    POST /api/reviews
    Body: { date, meal_type, user_id, text }
    - user_id가 빈 문자열이면 익명으로 저장
    - 욕설 포함 시 400 반환
    """
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="리뷰 내용을 입력해주세요.")

    banned = contains_banned(text)
    if banned:
        raise HTTPException(status_code=400, detail="욕설이나 부적절한 표현이 포함되어 있습니다.")

    author = payload.user_id.strip() if payload.user_id.strip() else "익명"

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/reviews",
            headers={**get_sb_headers(), "Prefer": "return=representation"},
            json={
                "date": payload.date,
                "meal_type": payload.meal_type,
                "user_id": author,
                "text": text,
            },
        )
        if res.status_code not in [200, 201]:
            raise HTTPException(status_code=res.status_code, detail=res.text)

        row = res.json()[0]
        return {
            "ok": True,
            "review": {
                "id": row["id"],
                "author": row["user_id"],
                "text": row["text"],
                "time": row["created_at"][11:16] if row.get("created_at") else "",
            },
        }



# ──────────────────────────────────────────────────────
# 문의하기 (Inquiries)
# ──────────────────────────────────────────────────────
# Supabase inquiries 테이블: id, user_id, subject, message, is_read, created_at

ADMIN_USER_IDS = set(
    filter(None, os.getenv("ADMIN_USER_IDS", "admin").split(","))
)

def require_admin(user_id: str):
    if user_id not in ADMIN_USER_IDS:
        raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다.")


class InquiryPayload(BaseModel):
    user_id: str
    subject: str = ""
    message: str

@app.post("/api/inquiries")
async def post_inquiry(payload: InquiryPayload):
    text = payload.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="문의 내용을 입력해주세요.")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/inquiries",
            headers={**get_sb_headers(), "Prefer": "return=representation"},
            json={
                "user_id": payload.user_id.strip() or "익명",
                "subject": payload.subject.strip(),
                "message": text,
                "is_read": False,
            },
        )
        if res.status_code not in [200, 201]:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        return {"ok": True}


@app.get("/api/inquiries")
async def get_inquiries(admin_user_id: str):
    require_admin(admin_user_id)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/inquiries",
            headers=get_sb_headers(),
            params={
                "select": "id,user_id,subject,message,is_read,created_at",
                "order": "created_at.desc",
            },
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        return res.json()


class InquiryReadPayload(BaseModel):
    admin_user_id: str
    is_read: bool

@app.patch("/api/inquiries/{inquiry_id}")
async def patch_inquiry_read(inquiry_id: int, payload: InquiryReadPayload):
    require_admin(payload.admin_user_id)
    async with httpx.AsyncClient() as client:
        res = await client.patch(
            f"{SUPABASE_URL}/rest/v1/inquiries",
            headers={**get_sb_headers(), "Prefer": "return=representation"},
            params={"id": f"eq.{inquiry_id}"},
            json={"is_read": payload.is_read},
        )
        if res.status_code not in [200, 201]:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        return {"ok": True}


@app.delete("/api/inquiries/{inquiry_id}")
async def delete_inquiry(inquiry_id: int, admin_user_id: str):
    require_admin(admin_user_id)
    async with httpx.AsyncClient() as client:
        res = await client.delete(
            f"{SUPABASE_URL}/rest/v1/inquiries",
            headers=get_sb_headers(),
            params={"id": f"eq.{inquiry_id}"},
        )
        if res.status_code not in [200, 204]:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("index:app", host="0.0.0.0", port=8000, reload=True)