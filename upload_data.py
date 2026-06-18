import json
import httpx
import asyncio

with open("data/config/config.json", "r", encoding='utf-8') as f:
    config: dict = json.load(f)
    SUPABASE_URL = config.get("SupaBaseUrl", "").strip()
    SUPABASE_KEY = config.get("SupaBaseKey", "").strip()

# 기본 헤더
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# ── 1. 급식 데이터 업로드 ──────────────────────────────────────────
async def upload_meal_data():
    try:
        with open('data/data/meal_data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("[INFO] meal_data.json 파일이 없어 급식 업로드를 건너뜁니다.")
        return

    async with httpx.AsyncClient() as client:
        for date, meals in data.items():
            for meal in meals:
                meal_type = meal["MMEAL_SC_NM"]
                
                cal_str = meal.get("CAL_INFO", "0")
                try:
                    cal_val = float(cal_str.split(' ')[0]) if cal_str else 0
                except ValueError:
                    cal_val = 0

                meal_row = {
                    "date": date,
                    "MMEAL_SC_NM": meal_type,
                    "CAL_INFO": cal_val,
                    "IMG_PATH": meal.get("IMG_PATH")
                }
                
                headers_meal = {**HEADERS, "Prefer": "return=representation, resolution=ignore"}
                res_meal = await client.post(
                    f"{SUPABASE_URL}/rest/v1/meal_data?on_conflict=date,MMEAL_SC_NM",
                    headers=headers_meal,
                    json=meal_row
                )
                
                if res_meal.status_code not in [200, 201]:
                    try:
                        error_json = res_meal.json()
                        error_code = error_json.get("code")
                        
                        if error_code == "23505":
                            print(f"({date} {meal_type}) 중복된 데이터")
                            continue
                        else:
                            print(f"에러 코드 {error_code} 발생: {error_json.get('message')}")
                            continue
                    except:
                        print(f"알 수 없는 에러: {res_meal.text}")
                        continue

                inserted_data = res_meal.json()
                if not inserted_data:
                    continue

                dishes = meal.get("DDISH_NM", [])
                dish_rows = []
                for dish in dishes:
                    dish_rows.append({
                        "date": date,
                        "MMEAL_SC_NM": meal_type,
                        "DDISH_NM": dish
                    })
                
                if dish_rows:
                    headers_dish = {**HEADERS, "Prefer": "return=minimal, resolution=ignore"}
                    res_dish = await client.post(
                        f"{SUPABASE_URL}/rest/v1/DDISH_NM",
                        headers=headers_dish,
                        json=dish_rows
                    )
                    
                    if res_dish.status_code not in [200, 201]:
                        print(f"DDISH_NM 저장 실패 ({date} {meal_type}): {res_dish.text}")

        print("급식 데이터 업로드 완료")

# ── 2. 학사일정 데이터 업로드 ──────────────────────────────────────
async def upload_schedule_data():
    try:
        with open('data/data/school_schedule.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("[INFO] school_schedule.json 파일이 없어 학사일정 업로드를 건너뜁니다.")
        return
    
    async with httpx.AsyncClient() as client:
        schedule_rows = []
        for date_key, info in data.items():
            schedule_text = info
            
            if schedule_text.strip() != "":
                schedule_rows.append({
                    "date": date_key,
                    "schedule": schedule_text
                })
        
        if not schedule_rows:
            print("업로드할 학사일정이 없습니다.")
            return
            
        headers_schedule = {**HEADERS, "Prefer": "return=minimal, resolution=ignore-duplicates"}
        
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/school_schedule?on_conflict=date",
            headers=headers_schedule,
            json=schedule_rows
        )
        
        if res.status_code not in [200, 201]:
            print(f"학사일정 저장 실패: {res.text}")
        else:
            print(f"학사일정 업로드 완료 (총 {len(schedule_rows)}건)")

# ── 메인 실행부 ────────────────────────────────────────────────
async def main():
    print("--- 데이터 업로드 시작 ---")
    await upload_meal_data()
    await upload_schedule_data()
    print("--- 데이터 업로드 종료 ---")

if __name__ == "__main__":
    asyncio.run(main())