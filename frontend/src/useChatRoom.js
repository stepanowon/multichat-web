import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import * as chatSocket from "./ws.js";
import { todayKst } from "./time.js";

// 강사/수강생 채팅 화면 공통: 날짜 목록, 선택 날짜의 메시지, WS 연결과 전송.
// 메시지 추가·삭제·서버 에러는 여기서 처리하고, 화면별 이벤트(user_list, system, share_updated,
// survey_updated 등)는 onEvent로 넘긴다.
export function useChatRoom(onEvent) {
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayKst);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);

  // WS 콜백은 마운트 시 한 번만 만들어지므로 최신 값은 ref로 참조한다.
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const today = todayKst();
    // 오늘 대화가 아직 없어도 드롭다운에서 오늘을 고를 수 있도록 추가.
    api.getDates().then((d) => setDates(d.dates.includes(today) ? d.dates : [...d.dates, today]));

    const ws = chatSocket.connectChatSocket((msg) => {
      if (msg.type === "message") {
        if (msg.date === selectedDateRef.current) setMessages((prev) => [...prev, msg]);
      } else if (msg.type === "deleted") {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      } else if (msg.type === "error") {
        alert(msg.message);
      } else {
        onEventRef.current?.(msg);
      }
    });
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  useEffect(() => {
    // 날짜를 빠르게 바꿀 때 늦게 도착한 이전 날짜 응답이 현재 목록을 덮지 않도록.
    let cancelled = false;
    // system(입퇴장) 로그는 MD 내보내기용으로만 서버에 남기고 화면 목록에는 넣지 않는다.
    api.getMessages(selectedDate).then((d) => {
      if (!cancelled) setMessages(d.messages.filter((m) => m.type !== "system"));
    });
    return () => { cancelled = true; };
  }, [selectedDate]);

  return {
    dates,
    selectedDate,
    setSelectedDate,
    messages,
    sendText: (text, to) => chatSocket.sendText(wsRef.current, text, to),
    sendImage: (base64, to) => chatSocket.sendImage(wsRef.current, base64, to),
    sendFile: (base64, fileName, to) => chatSocket.sendFile(wsRef.current, base64, fileName, to),
    deleteMessage: (id, date) => chatSocket.deleteMessage(wsRef.current, id, date),
    kickUser: (identifier) => chatSocket.kickUser(wsRef.current, identifier),
  };
}
