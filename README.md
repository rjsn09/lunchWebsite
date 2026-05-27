# 인마고 급식 게시판

## 환경변수 설정

Vercel 대시보드 또는 `.env` 파일에 아래 두 값을 설정해야 합니다.

| 변수명 | 설명 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL (예: `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase anon public key |

> `config.json`은 커밋되지 않습니다 (`.gitignore` 참고).

## Supabase 테이블 구조

### `meal_data`
| 컬럼 | 타입 |
|---|---|
| date | text |
| MMEAL_SC_NM | text |
| CAL_INFO | text |
| IMG_PATH | text |

### `DDISH_NM`
| 컬럼 | 타입 |
|---|---|
| date | text |
| MMEAL_SC_NM | text |
| DDISH_NM | text |

### `ratings`
| 컬럼 | 타입 |
|---|---|
| id | int (PK) |
| date | text |
| MMEAL_SC_NM | text |
| score | float |
| rating_times | int |
| total | float |

## 로컬 개발

```bash
# 백엔드
pip install -r requirements.txt
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_ANON_KEY="eyJ..."
python api/index.py   # → http://localhost:8000

# 프론트엔드 (새 터미널)
cd frontend
npm install
npm run dev           # → http://localhost:5173
```

## Vercel 배포

```bash
vercel
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
```
