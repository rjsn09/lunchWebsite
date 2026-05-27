import React from "react";

interface CalendarProps {
  viewDate: Date;
  onDateSelect: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const Calendar: React.FC<CalendarProps> = ({
  viewDate,
  onDateSelect,
  onPrevMonth,
  onNextMonth,
}) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const selectedDate = viewDate.getDate();

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= lastDate; i++) cells.push(i);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <aside className="panel left-panel">
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={onPrevMonth}>
          ◀
        </button>
        <span>
          {year}년 {month + 1}월
        </span>
        <button className="calendar-nav-btn" onClick={onNextMonth}>
          ▶
        </button>
      </div>
      <table className="calendar-table">
        <thead>
          <tr>
            <th style={{ color: "#d9534f" }}>일</th>
            <th>월</th>
            <th>화</th>
            <th>수</th>
            <th>목</th>
            <th>금</th>
            <th style={{ color: "#5cb85c" }}>토</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((day, ci) => (
                <td
                  key={ci}
                  className={day === selectedDate ? "selected" : ""}
                  onClick={() => {
                    if (day) onDateSelect(new Date(year, month, day));
                  }}
                >
                  {day ?? ""}
                </td>
              ))}
              {row.length < 7 &&
                Array.from({ length: 7 - row.length }).map((_, i) => (
                  <td key={`empty-${i}`} />
                ))}
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
};

export default Calendar;
