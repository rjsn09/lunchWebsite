import React, { useState, useEffect } from "react";

// 1. ✅ initialDate 속성 추가
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule?: Record<string, [number, string]>;
  initialDate?: Date; // App.tsx에서 넘겨주는 초기 날짜
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}${String(month + 1).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

export default function ScheduleModal({ 
  isOpen, 
  onClose, 
  schedule = {}, 
  initialDate = new Date()
}: ScheduleModalProps) {
  const [viewDate, setViewDate] = useState(initialDate);

  useEffect(() => {
    if (isOpen) {
      setViewDate(initialDate);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const onPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const onNextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= lastDate; i++) cells.push(i);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  // 모달 밖 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="calendar-modal-backdrop" onClick={handleBackdropClick}>
      <div className="calendar-modal-content">
        <button className="calendar-modal-close" onClick={onClose}>×</button>

        {/* 1. 상단 월 이동 네비게이션 */}
        <div className="calendar-header-nav">
          <button onClick={onPrevMonth}>&lt;</button>
          <h2>{year}.{String(month + 1).padStart(2, "0")}</h2>
          <button onClick={onNextMonth}>&gt;</button>
        </div>

        {/* 2. 컨트롤 탭 영역 (디자인용) */}
        <div className="calendar-controls">
          <div className="calendar-tab-group">
            <button className="calendar-tab active">전체</button>
            <button className="calendar-tab">카테고리1</button>
            <button className="calendar-tab">카테고리2</button>
            <button className="calendar-tab">카테고리3</button>
          </div>
          <div className="calendar-tab-group">
            <button className="calendar-tab">주간</button>
            <button className="calendar-tab active">월간</button>
            <button className="calendar-tab">연간</button>
          </div>
        </div>

        {/* 3. 캘린더 그리드 영역 */}
        <table className="calendar-grid-table">
          <thead>
            <tr>
              <th>일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th>토</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((day, ci) => {
                  let displayText = "";

                  if (day) {
                    const entry = schedule[toDateStr(year, month, day)];
                    if (entry && entry[1]) {
                      displayText = entry[1];
                    }
                    
                    // ✅ 1. 토요휴업일 문자열을 토요일로 변환
                    if (displayText.includes("토요휴업일")) {
                      displayText = displayText.replace(/토요휴업일/g, "토요일");
                    }
                    
                    // ✅ 2. 빈 일정이면서 주말인 경우 텍스트 강제 추가
                    if (!displayText) {
                      if (ci === 0) displayText = "일요일"; // 일요일 열
                      if (ci === 6) displayText = "토요일"; // 토요일 열
                    }
                  }

                  // 이벤트 바의 색상을 글자 길이나 날짜 등 기준에 따라 여러 색으로 분배 (사진과 유사하게)
                  const colorClass = `event-bg-${(day || 0) % 3}`;

                  return (
                    <td key={ci}>
                      {day && <span className="calendar-date-num">{day}</span>}
                      {day && displayText && (
                        <div className={`calendar-event ${colorClass}`} title={displayText}>
                          {displayText}
                        </div>
                      )}
                    </td>
                  );
                })}
                {/* 빈 칸 채우기 */}
                {row.length < 7 &&
                  Array.from({ length: 7 - row.length }).map((_, i) => (
                    <td key={`empty-${i}`} />
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}