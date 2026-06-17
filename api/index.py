import os
import httpx
import smtplib
from email.mime.text import MIMEText
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

# Gmail SMTP 설정 (환경변수로 관리)
GMAIL_USER   = os.getenv("GMAIL_USER", "").strip()    # 발신 Gmail 주소
GMAIL_PASS   = os.getenv("GMAIL_PASS", "").strip()    # Gmail 앱 비밀번호
ADMIN_EMAIL  = os.getenv("ADMIN_EMAIL", "").strip()   # 운영자 수신 이메일

def get_sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }

# ──────────────────────────────────────────────────────
# 유틸: 요청자가 실제 관리자인지 DB에서 매번 확인
# ──────────────────────────────────────────────────────
async def verify_admin(user_id: str) -> bool:
    """Supabase users 테이블의 is_admin 컬럼을 실시간으로 확인합니다."""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=get_sb_headers(),
            params={"select": "is_admin", "user_id": f"eq.{user_id}"},
        )
        if res.status_code != 200 or not res.json():
            return False
        return bool(res.json()[0].get("is_admin", False))


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
        meal_task = client.get(
            f"{SUPABASE_URL}/rest/v1/meal_data",
            headers=get_sb_headers(),
            params={"limit": 10000}
        )
        dish_task = client.get(
            f"{SUPABASE_URL}/rest/v1/DDISH_NM",
            headers=get_sb_headers(),
            params={"limit": 10000}
        )
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

        return {
            "ok": True,
            "user_id": existing["user_id"],
            "is_admin": bool(existing.get("is_admin", False)),  # ← 추가
        }


# ──────────────────────────────────────────────────────
# 리뷰
# ──────────────────────────────────────────────────────

@app.get("/api/reviews")
async def get_reviews(date: str, meal_type: str):
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


class ReviewPayload(BaseModel):
    date: str
    meal_type: str
    user_id: str
    text: str

@app.post("/api/reviews")
async def post_review(payload: ReviewPayload):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="리뷰 내용을 입력해주세요.")
    if not payload.user_id.strip():
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/reviews",
            headers={**get_sb_headers(), "Prefer": "return=representation"},
            json={
                "date": payload.date,
                "meal_type": payload.meal_type,
                "user_id": payload.user_id,
                "text": payload.text.strip(),
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


# ── 관리자: 리뷰 수정 ─────────────────────────────────

class ReviewEditPayload(BaseModel):
    review_id: str | int
    new_text: str
    admin_user_id: str   # 프론트가 전달하는 요청자 ID → 백엔드가 DB로 재검증

@app.patch("/api/admin/reviews")
async def admin_edit_review(payload: ReviewEditPayload):
    if not await verify_admin(payload.admin_user_id):
        raise HTTPException(status_code=403, detail="관리자 권한이 없습니다.")
    if not payload.new_text.strip():
        raise HTTPException(status_code=400, detail="수정할 내용을 입력해주세요.")

    async with httpx.AsyncClient() as client:
        res = await client.patch(
            f"{SUPABASE_URL}/rest/v1/reviews",
            headers={**get_sb_headers(), "Prefer": "return=representation"},
            params={"id": f"eq.{payload.review_id}"},
            json={"text": payload.new_text.strip()},
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


# ── 관리자: 리뷰 삭제 ─────────────────────────────────

class ReviewDeletePayload(BaseModel):
    review_id: str | int
    admin_user_id: str

@app.delete("/api/admin/reviews")
async def admin_delete_review(payload: ReviewDeletePayload):
    if not await verify_admin(payload.admin_user_id):
        raise HTTPException(status_code=403, detail="관리자 권한이 없습니다.")

    async with httpx.AsyncClient() as client:
        res = await client.delete(
            f"{SUPABASE_URL}/rest/v1/reviews",
            headers=get_sb_headers(),
            params={"id": f"eq.{payload.review_id}"},
        )
        if res.status_code not in [200, 204]:
            raise HTTPException(status_code=res.status_code, detail=res.text)

        return {"ok": True}


# ──────────────────────────────────────────────────────
# 문의하기
# ──────────────────────────────────────────────────────

class InquiryPayload(BaseModel):
    user_id: str   # 비로그인 시 "익명" 등 전달
    subject: str
    message: str

@app.post("/api/inquiry")
async def post_inquiry(payload: InquiryPayload):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="문의 내용을 입력해주세요.")

    # 1) Supabase에 저장
    async with httpx.AsyncClient() as client:
        ins_res = await client.post(
            f"{SUPABASE_URL}/rest/v1/inquiries",
            headers={**get_sb_headers(), "Prefer": "return=representation"},
            json={
                "user_id": payload.user_id or "익명",
                "subject": payload.subject.strip() or "(제목 없음)",
                "message": payload.message.strip(),
            },
        )
        if ins_res.status_code not in [200, 201]:
            raise HTTPException(status_code=ins_res.status_code, detail=ins_res.text)

    # 2) Gmail SMTP로 운영자에게 발송 (환경변수 미설정 시 스킵)
    if GMAIL_USER and GMAIL_PASS and ADMIN_EMAIL:
        try:
            body = (
                f"보낸 사람: {payload.user_id or '익명'}\n"
                f"제목: {payload.subject or '(제목 없음)'}\n\n"
                f"{payload.message}"
            )
            msg = MIMEText(body, "plain", "utf-8")
            msg["Subject"] = f"[인마고 급식 문의] {payload.subject or '(제목 없음)'}"
            msg["From"] = GMAIL_USER
            msg["To"] = ADMIN_EMAIL

            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
                smtp.login(GMAIL_USER, GMAIL_PASS)
                smtp.sendmail(GMAIL_USER, ADMIN_EMAIL, msg.as_string())
        except Exception as e:
            # 이메일 실패는 저장은 됐으므로 경고만
            print(f"[WARN] 이메일 발송 실패: {e}")

    return {"ok": True, "message": "문의가 접수되었습니다."}


# ── 관리자: 문의 목록 조회 ────────────────────────────

@app.get("/api/admin/inquiries")
async def get_inquiries(admin_user_id: str):
    if not await verify_admin(admin_user_id):
        raise HTTPException(status_code=403, detail="관리자 권한이 없습니다.")

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/inquiries",
            headers=get_sb_headers(),
            params={
                "select": "id,user_id,subject,message,created_at",
                "order": "created_at.desc",
                "limit": 200,
            },
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)

        return [
            {
                "id": r["id"],
                "user_id": r["user_id"],
                "subject": r["subject"],
                "message": r["message"],
                "created_at": r["created_at"],
            }
            for r in res.json()
        ]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("index:app", host="0.0.0.0", port=8000, reload=True)