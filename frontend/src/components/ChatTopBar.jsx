import { api } from "../api.js";
import DateDropdown from "./DateDropdown.jsx";

// 상단 바: 제목 + (화면별 추가 버튼) + 날짜 선택 + 선택 날짜 대화 MD 다운로드 + 나가기.
export default function ChatTopBar({ title, chat, onLogout, children }) {
  return (
    <div className="top-bar">
      <span>{title}</span>
      <div className="top-bar-actions">
        {children}
        <DateDropdown dates={chat.dates} value={chat.selectedDate} onChange={chat.setSelectedDate} />
        <a className="button ghost small" href={api.exportUrl(chat.selectedDate)}>MD 다운로드</a>
        <button className="button ghost small" onClick={onLogout}>나가기</button>
      </div>
    </div>
  );
}
