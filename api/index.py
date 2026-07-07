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
    user_id: str = ""  # 1인 1회 추적용

@app.post("/api/ratings")
async def post_rating(payload: RatingPayload):
    """
    별점 1인 1회: user_ratings 테이블로 개인 기록 관리.
    집계는 ratings 테이블에서 rating_times / total 로 평균 계산.
    
    user_ratings 테이블: id, date, meal_type, user_id, score, created_at
    """
    async with httpx.AsyncClient() as client:
        # ── 1. 이미 별점을 남겼는지 확인 ──────────────────
        prev_score = 0.0
        has_voted = False

        if payload.user_id:
            check_res = await client.get(
                f"{SUPABASE_URL}/rest/v1/user_ratings",
                headers=get_sb_headers(),
                params={
                    "select": "id,score",
                    "date": f"eq.{payload.date_str}",
                    "meal_type": f"eq.{payload.meal_type}",
                    "user_id": f"eq.{payload.user_id}",
                },
            )
            if check_res.status_code == 200 and check_res.json():
                has_voted = True
                prev_score = check_res.json()[0]["score"]
                prev_id = check_res.json()[0]["id"]

        # ── 2. 집계 테이블 조회 ───────────────────────────
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

        # ── 3. 집계 계산 (재투표면 이전 점수 차감) ─────────
        if has_voted:
            total = total - prev_score + payload.score
        else:
            rating_times += 1
            total += payload.score
        fin_score = round(total / rating_times, 1) if rating_times > 0 else payload.score

        agg_body = {
            "date": payload.date_str,
            "MMEAL_SC_NM": payload.meal_type,
            "score": fin_score,
            "rating_times": rating_times,
            "total": total,
        }

        # ── 4. 집계 저장 ──────────────────────────────────
        if existing:
            save_res = await client.patch(
                f"{SUPABASE_URL}/rest/v1/ratings",
                headers={**get_sb_headers(), "Prefer": "return=representation"},
                params={"id": f"eq.{existing['id']}"},
                json=agg_body,
            )
        else:
            save_res = await client.post(
                f"{SUPABASE_URL}/rest/v1/ratings",
                headers={**get_sb_headers(), "Prefer": "return=representation"},
                json=agg_body,
            )
        if save_res.status_code not in [200, 201]:
            raise HTTPException(status_code=save_res.status_code, detail=save_res.text)

        # ── 5. 개인 별점 저장 ─────────────────────────────
        if payload.user_id:
            user_body = {"date": payload.date_str, "meal_type": payload.meal_type,
                         "user_id": payload.user_id, "score": payload.score}
            if has_voted:
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/user_ratings",
                    headers=get_sb_headers(),
                    params={"id": f"eq.{prev_id}"},
                    json={"score": payload.score},
                )
            else:
                await client.post(
                    f"{SUPABASE_URL}/rest/v1/user_ratings",
                    headers=get_sb_headers(),
                    json=user_body,
                )

        return {"ok": True, "fin_score": fin_score}


@app.get("/api/ratings/mine")
async def get_my_ratings(user_id: str):
    """GET /api/ratings/mine?user_id= — 내가 남긴 별점 목록"""
    if not user_id:
        return {}
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_ratings",
            headers=get_sb_headers(),
            params={"select": "date,meal_type,score", "user_id": f"eq.{user_id}"},
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        result: dict = {}
        for row in res.json():
            d = row["date"]
            if d not in result:
                result[d] = {}
            result[d][row["meal_type"]] = row["score"]
        return result


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
                "select": "user_id,password,is_admin",
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

        user_id = existing["user_id"]
        return {
            "ok": True,
            "user_id": user_id,
            "is_admin": bool(existing.get("is_admin", False)),
        }


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
# Supabase inquiries 테이블: id, user_id, subject, message, admin_reply, replied_at, created_at

async def require_admin(user_id: str):
    """users 테이블의 is_admin 컬럼으로 관리자 여부 확인"""
    if not user_id:
        raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다.")
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=get_sb_headers(),
            params={"select": "is_admin", "user_id": f"eq.{user_id}"},
        )
        rows = res.json() if res.status_code == 200 else []
        if not rows or not rows[0].get("is_admin"):
            raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다.")


class InquiryPayload(BaseModel):
    user_id: str
    subject: str = ""
    message: str

@app.post("/api/inquiries")
@app.post("/api/inquiry")
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
            },
        )
        if res.status_code not in [200, 201]:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        return {"ok": True}


@app.get("/api/admin/inquiries")
async def get_inquiries(admin_user_id: str):
    await require_admin(admin_user_id)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/inquiries",
            headers=get_sb_headers(),
            params={
                "select": "*",
                "order": "created_at.desc",
            },
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        rows = res.json()
        # admin_reply / replied_at 컬럼이 없을 경우 대비
        for r in rows:
            r.setdefault("admin_reply", None)
            r.setdefault("replied_at", None)
        return rows


@app.get("/api/inquiries/mine")
async def get_my_inquiries(user_id: str):
    if not user_id or user_id == "익명":
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/inquiries",
            headers=get_sb_headers(),
            params={
                "select": "*",
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
            },
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        rows = res.json()
        for r in rows:
            r.setdefault("admin_reply", None)
            r.setdefault("replied_at", None)
        return rows


class InquiryReplyPayload(BaseModel):
    inquiry_id: int
    reply: str
    admin_user_id: str

@app.patch("/api/admin/inquiries/reply")
async def reply_to_inquiry(payload: InquiryReplyPayload):
    await require_admin(payload.admin_user_id)
    if not payload.reply.strip():
        raise HTTPException(status_code=400, detail="답변 내용을 입력해주세요.")
    from datetime import datetime, timezone
    async with httpx.AsyncClient() as client:
        res = await client.patch(
            f"{SUPABASE_URL}/rest/v1/inquiries",
            headers={**get_sb_headers(), "Prefer": "return=minimal"},
            params={"id": f"eq.{payload.inquiry_id}"},
            json={
                "admin_reply": payload.reply.strip(),
                "replied_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        if res.status_code not in [200, 201, 204]:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        return {"ok": True}




@app.delete("/api/inquiries/{inquiry_id}")
async def delete_inquiry(inquiry_id: int, admin_user_id: str):
    await require_admin(admin_user_id)
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


# ──────────────────────────────────────────────────────
# 학사일정 (NEIS SchoolSchedule API)
# ──────────────────────────────────────────────────────

NEIS_KEY         = os.getenv("NEIS_API_KEY", "").strip()
OFFICE_CODE      = os.getenv("OFFICE_CODE", "E10").strip()   # 인천시교육청
SCHOOL_CODE      = os.getenv("SCHOOL_CODE", "7310370").strip()  # 인천전자마이스터고
NEIS_SCHEDULE_URL = "https://open.neis.go.kr/hub/SchoolSchedule"

@app.get("/api/schedule")
async def get_schedule(year: int):
    """
    GET /api/schedule?year=2026
    NEIS SchoolSchedule API → Record<YYYYMMDD, [cate_code, event_name]>
    """
    if not NEIS_KEY:
        raise HTTPException(status_code=503, detail="NEIS_API_KEY 환경변수가 설정되지 않았습니다.")

    from_ymd = f"{year}0101"
    to_ymd   = f"{year}1231"

    all_rows: list = []
    p_index = 1
    p_size  = 200

    async with httpx.AsyncClient() as client:
        while True:
            params = {
                "KEY": NEIS_KEY,
                "Type": "json",
                "pIndex": str(p_index),
                "pSize": str(p_size),
                "ATPT_OFCDC_SC_CODE": OFFICE_CODE,
                "SD_SCHUL_CODE": SCHOOL_CODE,
                "AA_FROM_YMD": from_ymd,
                "AA_TO_YMD": to_ymd,
            }
            res = await client.get(NEIS_SCHEDULE_URL, params=params, timeout=10.0)
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail="NEIS API 오류")

            data = res.json()
            # 데이터 없음 (INFO-200 등)
            if "SchoolSchedule" not in data:
                break

            rows = data["SchoolSchedule"][1].get("row", [])
            all_rows.extend(rows)

            if len(rows) < p_size:
                break
            p_index += 1

    # { "YYYYMMDD": [cate_code, event_name] } 형식으로 변환
    result: dict[str, list] = {}
    for row in all_rows:
        date_key = row.get("AA_YMD", "")
        event_nm = row.get("EVENT_NM", "").strip()
        cate_code = int(row.get("EVENT_CATE", 0) or 0)
        if date_key and event_nm:
            if date_key in result:
                # 같은 날 일정이 여러 개면 줄바꿈으로 합침
                result[date_key][1] = result[date_key][1] + " / " + event_nm
            else:
                result[date_key] = [cate_code, event_nm]

    return result