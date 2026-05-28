# 인마고 급식 게시판

## 환경변수

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
