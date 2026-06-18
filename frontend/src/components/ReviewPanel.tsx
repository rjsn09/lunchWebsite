import React, { useState, useEffect, useRef, useCallback } from "react";
import type { MealType, ReviewItem } from "../types";
import { adminEditReview, adminDeleteReview } from "../api";

interface ReviewPanelProps {
  viewDate: Date;
  mealType: MealType;
  username: string;
  isAdmin: boolean;
  onRequireLogin?: () => void;
  onToast: (msg: string, isError?: boolean) => void;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// ══════════════════════════════════════════════════════════════
//  비속어 / 욕설 / 혐오표현 필터
// ══════════════════════════════════════════════════════════════

// ── 1. 금지어 목록 ────────────────────────────────────────────
const BAN_WORDS_KO = [
  // 욕설 기본형 + 변형
  "시발","씨발","씨팔","시팔","씨빨","시빨","쉬발","쉬팔","씨바","시바","씨방","시방",
  "ㅅㅂ","ㅆㅂ","ㅅㅍ","ㅆㅍ",
  "병신","ㅂㅅ","븅신","뻥신","벙신","봉신","빙신",
  "새끼","쌔끼","ㅅㄲ","색끼","세끼","쇄끼","새ㄲ","쉐끼","쉑",
  "지랄","ㅈㄹ","지럴","찌랄","지랭",
  "개새","개색","개세","개쉐","개시","갠새","개쉑",
  "존나","ㅈㄴ","존내","좆나","줜나","전나","젠나","죤나","죤내",
  "씹","씹새","씹놈","씹년","씹것","씹할","씹치","씹덕",
  "미친","ㅁㅊ","미쳤","미칫","미첬","미친놈","미친년","미친새",
  "꺼져","뒤져","뒤지","뒈져","뒈지","뒤졌","뒈졌","뒤질","뒈질","뒤져라",
  "죽어","죽여","죽일","죽어라","죽어버","죽여버",
  "닥쳐","닥처","닥쳐라","닥치",
  "개소리","개소","개짓","개같","개판","개망","개나리","개나발",
  "찐따","정신병","장애인새","틀딱","꼰대새","틀딱새","찐다","찐다새",
  "멍청","바보새","바보같","천치","얼간","등신","멍텅",
  "ㄲㅈ","꺼지","꺼져라","ㄲㅈ해",
  "좆","좇","ㅈ같","좃","졷","좆같","좆밥","좆만","좆도","좆까",
  "보지","자지","성기","음부","항문","음경","음핵","클리",
  "창녀","창년","갈보","화냥","화냥년","갈보년","창녀새","매춘","윤락",
  "애미","애비","에미","에비","니애미","니에미","느그엄","느그애미","니엄마","니아빠",
  "엄창","어미새","에미새","애미새",
  // 혐오·차별
  "홍어","홍어새","전라디언","경상디언","전라도새","경상도새",
  "짱깨","짱개","짱꼴라","되놈","왜놈","쪽바리","쪽발이","짱께","짱깨새",
  "흑형","깜둥","깜둥이","검둥","검둥이",
  "틀딱","꼰대","노인네새","할배새","할매새","노인새",
  "보슬아치","한남충","한녀충","개한남","개한녀","페미새","꼴페미","한남새","한녀새",
  "장애새","저능아","지적장애","정신지체","병자새",
  // 성적 표현
  "섹스","섹쓰","야동","야사","포르노","강간","윤간","성폭행","성추행","성희롱","겁탈","능욕",
  "자위","오나니","사정","발기","딸딸","딸치","딸아","딸딸이",
  "가슴만져","가슴빨","유두","젖꼭지","젖탱이","젖통","가슴빨아",
  // 학교폭력·위협
  "패줄","패버","때려줄","때려버","죽빵","주먹날","칼들고",
  "협박","갈취","삥뜯","쥐어패","밟아줄","밟아버",
  "왕따","따돌림시","따돌려","학폭",
  // 자해·자살 조장
  "자살해","죽어버려","뒤져버려","목매","목매달아","손목그어","자해해","자해하",
  // 도박·마약
  "마약","필로폰","히로뽕","메스암페타민","대마초","코카인","헤로인","아편","엑스터시",
  "도박","도박사이트","배팅사이트","불법배팅","불법도박",
];

const BAN_WORDS_EN = [
  "fuck","shit","bitch","asshole","cunt","nigger","faggot","whore",
  "bastard","motherfucker","dickhead","cocksucker","rape","porn",
  "pussy","dick","cock","ass","slut","piss","retard","negro",
];

// ── 2. 영문 → 한글 자판 역변환 ───────────────────────────────
const EN_TO_KO_MAP: Record<string, string> = {
  q:"ㅂ",w:"ㅈ",e:"ㄷ",r:"ㄱ",t:"ㅅ",y:"ㅛ",u:"ㅕ",i:"ㅑ",o:"ㅐ",p:"ㅔ",
  a:"ㅁ",s:"ㄴ",d:"ㅇ",f:"ㄹ",g:"ㅎ",h:"ㅗ",j:"ㅓ",k:"ㅏ",l:"ㅣ",
  z:"ㅋ",x:"ㅌ",c:"ㅊ",v:"ㅍ",b:"ㅠ",n:"ㅜ",m:"ㅡ",
  Q:"ㅃ",W:"ㅉ",E:"ㄸ",R:"ㄲ",T:"ㅆ",O:"ㅒ",P:"ㅖ",
};

const CHOSUNG_LIST  = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNGSUNG_LIST = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONGSUNG_LIST = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

/** 자모 배열 → 한글 음절로 조합 */
function composeJamo(jamos: string[]): string {
  let result = "";
  let i = 0;
  while (i < jamos.length) {
    const cIdx = CHOSUNG_LIST.indexOf(jamos[i]);
    if (cIdx !== -1 && i + 1 < jamos.length) {
      const vIdx = JUNGSUNG_LIST.indexOf(jamos[i + 1]);
      if (vIdx !== -1) {
        // 종성 확인: 다음 자모가 종성 후보이고 그 다음이 모음이 아닌 경우에만 종성으로
        let jIdx = 0;
        if (i + 2 < jamos.length) {
          const candidateJ = JONGSUNG_LIST.indexOf(jamos[i + 2]);
          const afterIsVowel = i + 3 < jamos.length && JUNGSUNG_LIST.indexOf(jamos[i + 3]) !== -1;
          if (candidateJ > 0 && !afterIsVowel) {
            jIdx = candidateJ;
            i += 3;
            result += String.fromCharCode(0xAC00 + cIdx * 588 + vIdx * 28 + jIdx);
            continue;
          }
        }
        result += String.fromCharCode(0xAC00 + cIdx * 588 + vIdx * 28);
        i += 2;
        continue;
      }
    }
    result += jamos[i];
    i++;
  }
  return result;
}

/** 영문 키보드 입력 → 한글로 완전 역변환 (tlqkf → 시발) */
function engToKor(text: string): string {
  // 한글이 이미 섞여있으면 영문 부분만 변환
  const jamos = text.split("").map((c) => EN_TO_KO_MAP[c] ?? c);
  return composeJamo(jamos);
}

// ── 3. 정규화 함수들 ─────────────────────────────────────────

/** 숫자→문자, 특수문자 제거, 소문자화, 연속 중복 제거 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e")
    .replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/8/g, "b")
    .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

/** 한글 음절 → 자모 분리 후 정규화 */
function decomposeAndNormalize(text: string): string {
  const CHOSUNG  = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  const JUNGSUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
  const JONGSUNG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  const decomposed = [...text].map((ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const off  = code - 0xAC00;
      const jong = off % 28;
      return CHOSUNG[Math.floor(off / 588)] +
             JUNGSUNG[Math.floor((off % 588) / 28)] +
             (jong ? JONGSUNG[jong] : "");
    }
    return ch;
  }).join("");
  return normalize(decomposed);
}

/** 유사발음 치환 */
function phonetic(text: string): string {
  return text
    .replace(/시/g,"씨").replace(/빠/g,"빨").replace(/파/g,"팔")
    .replace(/세/g,"씨").replace(/쉐/g,"씨").replace(/쉬/g,"씨")
    .replace(/봉/g,"병").replace(/벙/g,"병").replace(/빙/g,"병")
    .replace(/좃/g,"좆").replace(/졷/g,"좆")
    .replace(/색/g,"새").replace(/쇄/g,"새").replace(/쌔/g,"새").replace(/쉑/g,"새")
    .replace(/줜/g,"존").replace(/죤/g,"존").replace(/전(?=나)/g,"존").replace(/젠(?=나)/g,"존")
    .replace(/뒈/g,"뒤").replace(/뒀/g,"뒤")
    .replace(/미칫/g,"미친").replace(/미첬/g,"미친")
    .replace(/에미/g,"애미").replace(/에비/g,"애비")
    .replace(/씨바$/g,"씨발").replace(/씨방/g,"씨발");
}

/** 영문 leetspeak 복원 */
function leetspeakEn(text: string): string {
  return text
    .replace(/f[\*\!u@]+ck/gi,"fuck").replace(/sh[\*\!]+t/gi,"shit")
    .replace(/b[\*\!]+tch/gi,"bitch").replace(/a[\*\!]+s+/gi,"ass")
    .replace(/c[\*\!]+nt/gi,"cunt").replace(/n[\*\!]+gg/gi,"nigg")
    .replace(/wh[\*\!]+re/gi,"whore").replace(/p[\*\!]+ssy/gi,"pussy")
    .replace(/d[\*\!]+ck/gi,"dick").replace(/c[\*\!]+ck/gi,"cock");
}

/** 별표·점 등 마스킹 기호 제거 */
function removeMask(text: string): string {
  return text.replace(/[*·•．\.ㆍ\-_~|ㅡ\s]/g, "");
}

// ── 4. 통합 탐지 함수 ─────────────────────────────────────────

export function containsBanWord(raw: string): { detected: boolean; reason: string } {

  // 변환 레이어 생성
  const layers: string[] = [
    normalize(raw),                          // 기본 정규화
    decomposeAndNormalize(raw),              // 자모 분리
    normalize(phonetic(raw)),                // 유사발음 치환
    decomposeAndNormalize(phonetic(raw)),    // 유사발음+자모분리
    normalize(removeMask(raw)),              // 마스킹 제거
    decomposeAndNormalize(removeMask(raw)),  // 마스킹제거+자모분리
    // ── 핵심 추가: 영문 자판 → 한글 역변환 ──
    normalize(engToKor(raw)),                            // tlqkf → 시발
    decomposeAndNormalize(engToKor(raw)),                // 역변환+자모분리
    normalize(engToKor(removeMask(raw))),                // 마스킹제거+역변환
    normalize(phonetic(engToKor(raw))),                  // 역변환+유사발음
    // 반복 자모 제거 후 역변환
    normalize(engToKor(raw.replace(/(.)\1+/g,"$1"))),   // tttlqkf → 시발
  ];

  // 한글 금지어 검사
  for (const word of BAN_WORDS_KO) {
    const wn = normalize(word);
    const wd = decomposeAndNormalize(word);
    for (const layer of layers) {
      if (layer.includes(wn) || layer.includes(wd))
        return { detected: true, reason: "욕설 또는 비속어" };
    }
  }

  // 영문 금지어 검사
  const enLayers = [
    raw.toLowerCase(),
    leetspeakEn(raw.toLowerCase()),
    removeMask(raw).toLowerCase(),
    leetspeakEn(removeMask(raw).toLowerCase()),
  ];
  for (const word of BAN_WORDS_EN) {
    for (const layer of enLayers) {
      if (layer.includes(word))
        return { detected: true, reason: "욕설 또는 비속어" };
    }
  }

  // ── 5. 패턴 기반 탐지 ────────────────────────────────────────

  // 초성 패턴 직접 매칭
  const CHOSUNG_PATTERNS = [
    /ㅅㅂ/,/ㅆㅂ/,/ㅂㅅ/,/ㅈㄹ/,/ㅈㄴ/,/ㅁㅊ/,/ㅅㄲ/,/ㄲㅈ/,
    /ㅈ같/,/ㄱㅅ끼/,/ㅈㄲ/,/ㅅㅍ/,/ㅆㅍ/,
  ];
  for (const pat of CHOSUNG_PATTERNS) {
    if (pat.test(raw)) return { detected: true, reason: "욕설 또는 비속어" };
  }

  // 영문 자판 초성 패턴 (tl=ㅅㅣ, qk=ㅂㅏ 등 분절 입력)
  const engJamo = raw.split("").map((c) => EN_TO_KO_MAP[c] ?? c).join("");
  for (const pat of CHOSUNG_PATTERNS) {
    if (pat.test(engJamo)) return { detected: true, reason: "욕설 또는 비속어" };
  }
  // 역변환 결과에도 초성 패턴 체크
  const converted = engToKor(raw);
  for (const pat of CHOSUNG_PATTERNS) {
    if (pat.test(converted)) return { detected: true, reason: "욕설 또는 비속어" };
  }

  // 개인정보·외부연락처·링크
  if (/\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4}/.test(raw))
    return { detected: true, reason: "개인정보(전화번호)가 포함되어 있습니다" };
  if (/(kakao|카카오|카톡|텔레그램|telegram|라인|line)\s*(id|아이디)?[\s:=]+\S+/i.test(raw))
    return { detected: true, reason: "외부 연락처 홍보는 허용되지 않습니다" };
  if (/(https?:\/\/|www\.)\S+/.test(raw))
    return { detected: true, reason: "링크 삽입은 허용되지 않습니다" };

  return { detected: false, reason: "" };
}

// ══════════════════════════════════════════════════════════════
//  관리자 인라인 수정/삭제 컴포넌트
// ══════════════════════════════════════════════════════════════

function AdminActions({
  review, adminUserId, onEdited, onDeleted, onToast,
}: {
  review: ReviewItem;
  adminUserId: string;
  onEdited: (id: string | number, newText: string) => void;
  onDeleted: (id: string | number) => void;
  onToast: (msg: string, isError?: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(review.text);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!editText.trim()) { onToast("내용을 입력해주세요.", true); return; }
    setSaving(true);
    try {
      await adminEditReview(review.id, editText, adminUserId);
      onEdited(review.id, editText.trim());
      setEditing(false);
      onToast("리뷰가 수정되었습니다.");
    } catch (e: any) {
      onToast(e.message || "수정 실패", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("이 리뷰를 삭제하시겠습니까?")) return;
    try {
      await adminDeleteReview(review.id, adminUserId);
      onDeleted(review.id);
      onToast("리뷰가 삭제되었습니다.");
    } catch (e: any) {
      onToast(e.message || "삭제 실패", true);
    }
  }

  const btnBase: React.CSSProperties = {
    padding: "3px 9px", borderRadius: 5, border: "none",
    fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  };

  if (editing) {
    return (
      <div style={{ marginTop: 6 }}>
        <input
          type="text" value={editText} autoFocus
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !saving) handleSave(); if (e.key === "Escape") setEditing(false); }}
          disabled={saving}
          style={{
            width: "100%", background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
            padding: "5px 9px", fontSize: 13, color: "var(--text-primary)",
            outline: "none", fontFamily: "inherit", marginBottom: 5,
          }}
        />
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ ...btnBase, background: "#ff8c42", color: "#fff", opacity: saving ? 0.5 : 1 }}>
            {saving ? "…" : "저장"}
          </button>
          <button onClick={() => { setEditing(false); setEditText(review.text); }}
            style={{ ...btnBase, background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
      <button onClick={() => { setEditing(true); setEditText(review.text); }}
        style={{ ...btnBase, background: "rgba(255,200,50,0.15)", color: "#ffc832" }}>수정</button>
      <button onClick={handleDelete}
        style={{ ...btnBase, background: "rgba(231,76,60,0.15)", color: "#e74c3c" }}>삭제</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ReviewPanel
// ══════════════════════════════════════════════════════════════

const ReviewPanel: React.FC<ReviewPanelProps> = ({ viewDate, mealType, username, isAdmin, onRequireLogin, onToast }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastFetchedKey, setLastFetchedKey] = useState("");

  const m = String(viewDate.getMonth() + 1).padStart(2, "0");
  const d = String(viewDate.getDate()).padStart(2, "0");
  const dateStr = toDateStr(viewDate);

  const fetchReviews = useCallback(async () => {
    const currentKey = `${dateStr}-${mealType}`;
    if (lastFetchedKey === currentKey && reviews.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?date=${dateStr}&meal_type=${encodeURIComponent(mealType)}`);
      if (!res.ok) throw new Error();
      const data: ReviewItem[] = await res.json();
      setReviews(data);
      setLastFetchedKey(currentKey);
    } catch {
      if (isOpen) onToast("리뷰를 불러오지 못했습니다.", true);
    } finally {
      setLoading(false);
    }
  }, [dateStr, mealType, isOpen, onToast, lastFetchedKey, reviews.length]);

  useEffect(() => { if (isOpen) fetchReviews(); }, [isOpen, fetchReviews]);
  useEffect(() => { setReviews([]); setLastFetchedKey(""); }, [dateStr, mealType]);

  async function submitReview() {
    const text = inputValue.trim();
    if (!username) {
      onToast("로그인 후 리뷰를 남길 수 있습니다.", true);
      onRequireLogin?.();
      return;
    }
    if (!text) { onToast("리뷰 내용을 입력해주세요!", true); return; }

    const { detected, reason } = containsBanWord(text);
    if (detected) {
      onToast(`${reason}가 포함되어 등록할 수 없습니다.`, true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, meal_type: mealType, user_id: username, text }),
      });
      const data = await res.json();
      if (!res.ok) { onToast(data.detail || "리뷰 등록에 실패했습니다.", true); return; }
      setReviews((prev) => [data.review, ...prev]);
      setInputValue("");
    } catch {
      onToast("서버에 연결할 수 없습니다.", true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdited(id: string | number, newText: string) {
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, text: newText } : r));
  }
  function handleDeleted(id: string | number) {
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="review-slide-container">
      <button
        ref={inputRef as any}
        className="review-trigger"
        id="reviewTriggerBtn"
        style={{ bottom: isOpen ? "calc(100% - 92px)" : "0" }}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        리뷰 보기 및 작성
      </button>

      <div className={`review-panel${isOpen ? " open" : ""}`} id="reviewPanel">
        <div className="review-header">
          <h3>
            <span>{parseInt(m)}월 {parseInt(d)}일</span>의 급식 리뷰 (
            <span>{mealType}</span>)
          </h3>
        </div>

        <div className="review-content" id="reviewList">
          {loading ? (
            <div className="review-loading">불러오는 중...</div>
          ) : reviews.length === 0 ? (
            <div className="review-empty">아직 등록된 리뷰가 없습니다.</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-item-meta">
                  <strong className="review-author">{r.author}</strong>
                  <span className="review-time">{parseInt(m)}월 {parseInt(d)}일 {r.time}</span>
                </div>
                <div className="review-text">{r.text}</div>
                {isAdmin && (
                  <AdminActions
                    review={r} adminUserId={username}
                    onEdited={handleEdited} onDeleted={handleDeleted} onToast={onToast}
                  />
                )}
              </div>
            ))
          )}
        </div>

        <div className="review-input-box" style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(0,0,0,0.15)",
        }}>
          {username ? (
            <>
              <span className="review-input-user" style={{
                fontSize: "12px", fontWeight: 700, color: "#ff8c42",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {username}
              </span>
              <input
                type="text" id="reviewInput" value={inputValue}
                placeholder="리뷰를 남겨보세요"
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !submitting) submitReview(); }}
                disabled={submitting}
                style={{
                  flex: 1, minWidth: 0, background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                  padding: "8px 12px", fontSize: "13px", color: "rgba(255,255,255,0.85)",
                  outline: "none", fontFamily: "inherit",
                }}
              />
              <button onClick={submitReview} disabled={submitting} style={{
                padding: "8px 16px", background: "#ff8c42", border: "none",
                borderRadius: "8px", color: "#fff", fontSize: "13px", fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.4 : 1,
                whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit",
              }}>
                {submitting ? "…" : "등록"}
              </button>
            </>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", gap: 10,
            }}>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                리뷰는 로그인 후 작성할 수 있어요.
              </span>
              <button
                onClick={() => onRequireLogin?.()}
                style={{
                  padding: "6px 14px", background: "#ff8c42", border: "none",
                  borderRadius: "7px", color: "#fff", fontSize: "12px", fontWeight: 700,
                  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit",
                }}
              >
                로그인하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel;