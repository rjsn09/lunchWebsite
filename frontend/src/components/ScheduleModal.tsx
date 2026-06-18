import React, { useMemo, useState } from "react";
import type { ScheduleData } from "../types";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleData;
  initialDate: Date;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen, onClose, schedule, initialDate,
}) => {
  const [viewDate, setViewDate] = useState<Date>(initialDate);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  const monthEntries = useMemo(() => {
    const prefix = `${year}${String(month + 1).padStart(2, "0")}`;
    return Object.entries(schedule)
      .filter(([dateStr]) => dateStr.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, entry]) => {
        const day = parseInt(dateStr.slice(6, 8), 10);
        const isHoliday = entry[0] === 0;
        const reason = entry[1];
        const weekday = new Date(year, month, day).toLocaleDateString("ko-KR", { weekday: "short" });
        return { dateStr, day, weekday, isHoliday, reason };
      });
  }, [schedule, year, month]);

  if (!isOpen) return null;

  return (
        <div
        className="not-supported-overlay"
        style={{ display: "flex" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
        <div 
            className="not-supported-card" 
            style={{ 
            width: "90vw", 
            maxWidth: "600px", 
            maxHeight: "90vh", 
            overflowY: "auto", 
            textAlign: "left",
            padding: "24px"
            }}
        >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button
            className="calendar-nav-btn"
            onClick={() => setViewDate((prev) => { const nd = new Date(prev); nd.setMonth(nd.getMonth() - 1); return nd; })}
          >
            ◀
          </button>
          <strong style={{ fontSize: "1.05rem" }}>{year}년 {month + 1}월 학사일정</strong>
          <button
            className="calendar-nav-btn"
            onClick={() => setViewDate((prev) => { const nd = new Date(prev); nd.setMonth(nd.getMonth() + 1); return nd; })}
          >
            ▶
          </button>
        </div>

        {monthEntries.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "16px 0" }}>
            이 달에는 등록된 학사일정이 없습니다.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {monthEntries.map(({ dateStr, day, weekday, isHoliday, reason }) => (
              <li
                key={dateStr}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "7px 4px", borderBottom: "1px solid var(--table-border)",
                }}
              >
                <span style={{ color: isHoliday ? "#e74c3c" : "var(--text-primary)", fontWeight: 600 }}>
                  {month + 1}월 {day}일 ({weekday})
                </span>
                <span style={{ color: isHoliday ? "#e74c3c" : "var(--text-secondary)", fontSize: "0.9em" }}>
                  {reason}
                </span>
              </li>
            ))}
          </ul>
        )}

        <button onClick={onClose} style={{ marginTop: 14, width: "100%" }}>
          확인
        </button>
      </div>
    </div>
  );
};

export default ScheduleModal;
