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

async def upload_meal_data():
    with open('data/data/meal_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    async with httpx.AsyncClient() as client:
        for date, meals in data.items():
            print(date, meal_type)
            
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
                        # 문자열을 JSON 딕셔너리로 변환
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

        print("완료")

if __name__ == "__main__":
    asyncio.run(upload_meal_data())