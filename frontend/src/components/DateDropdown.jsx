export default function DateDropdown({ dates, value, onChange }) {
  return (
    <select className="date-dropdown" value={value || ""} onChange={(e) => onChange(e.target.value)}>
      {dates.length === 0 && <option value="">대화 없음</option>}
      {dates.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  );
}
