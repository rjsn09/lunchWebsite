import React, { useState, useEffect } from "react";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule?: Record<string, [number, string]>;
  initialDate?: Date;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}${String(month + 1).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function getEventColorClass(text: string): string {
  if (!text) return "";
  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    sum += text.charCodeAt(i);
  }
  return `event-bg-${sum % 3}`;
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="calendar-modal-backdrop" onClick={handleBackdropClick}>
      <div className="calendar-modal-content">
        <button className="calendar-modal-close" onClick={onClose}>×</button>

        <div className="calendar-header-nav">
          <button onClick={onPrevMonth}>&lt;</button>
          <h2>{year}.{String(month + 1).padStart(2, "0")}</h2>
          <button onClick={onNextMonth}>&gt;</button>
        </div>

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
                    
                    if (displayText.includes("토요휴업일")) {
                      displayText = displayText.replace(/토요휴업일/g, "토요일");
                    }
                    
                    if (!displayText) {
                      if (ci === 0) displayText = "일요일";
                      if (ci === 6) displayText = "토요일";
                    }
                  }

                  // ✅ 일정 내용을 기반으로 동일한 색상을 가져옴
                  const colorClass = getEventColorClass(displayText);

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