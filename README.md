# 인마고 급식 게시판

React (TSX) + FastAPI (Python) 기반 급식 대시보드입니다.

## 프로젝트 구조

```
/
├── frontend/              # Vite + React + TypeScript
│   ├── src/
│   │   ├── main.tsx       # 진입점
│   │   ├── App.tsx        # 루트 컴포넌트
│   │   ├── index.css      # 전역 스타일 (CSS 변수 기반 다크/라이트 테마)
│   │   ├── types.ts       # 타입 정의
│   │   ├── api.ts         # fetch 유틸리티
│   │   └── components/
│   │       ├── Calendar.tsx      # 월간 달력
│   │       ├── MealDetail.tsx    # 급식 상세 (가운데 패널)
│   │       ├── WeeklyPanel.tsx   # 주간 식단표
│   │       ├── RatingModal.tsx   # 별점 모달 (0.5단위)
│   │       ├── ReviewPanel.tsx   # 슬라이드 리뷰 패널
│   │       ├── StarDisplay.tsx   # 별점 표시 컴포넌트
│   │       └── useToast.ts       # 토스트 훅
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts     # 빌드 → ../public, /api 프록시 설정
│
├── api/
│   └── index.py           # FastAPI 앱 (Vercel Serverless)
│
├── requirements.txt
├── vercel.json
└── README.md
```

## 로컬 개발

### 백엔드 (FastAPI)

```bash
# 가상환경 생성 (선택)
python -m venv venv && source venv/bin/activate

pip install -r requirements.txt

# NEIS API 키 설정 (없으면 빈 데이터 반환)
export NEIS_API_KEY="your_api_key_here"

python api/index.py
# → http://localhost:8000
```

### 프론트엔드 (React)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173  (백엔드 /api 프록시 자동 설정)
```

## Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel

# 환경변수 설정
vercel env add NEIS_API_KEY
```

## 환경변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `NEIS_API_KEY` | NEIS 교육정보 개방 포털 API 키 | 권장 |

NEIS API 키는 https://open.neis.go.kr 에서 발급받을 수 있습니다.

## 기능

- 월간 달력 — 날짜 선택으로 해당일 급식 조회
- 급식 상세 — 조식/중식/석식 탭 전환, 사진, 반찬 목록, 칼로리
- 별점 — 0.5 단위 별점 입력 및 평균 표시
- 주간 식단표 — 선택 주 월~금 식단
- 리뷰 패널 — 슬라이드 업 리뷰 작성
- 다크/라이트 테마 전환
