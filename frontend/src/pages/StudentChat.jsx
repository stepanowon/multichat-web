import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { connectChatSocket, sendText, sendImage, sendFile, deleteMessage } from "../ws.js";
import DateDropdown from "../components/DateDropdown.jsx";
import MessageList from "../components/MessageList.jsx";
import ChatInput from "../components/ChatInput.jsx";
import FileTree from "../components/FileTree.jsx";
import { useFileDrop } from "../useFileDrop.js";

const today = () => new Date().toISOString().slice(0, 10);

export default function StudentChat({ user, onLogout }) {
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [messages, setMessages] = useState([]);
  const [tree, setTree] = useState([]);
  const [target, setTarget] = useState("all");
  const wsRef = useRef(null);
  const selectedDateRef = useRef(selectedDate);

  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  useEffect(() => {
    api.getDates().then((d) => setDates(d.dates.includes(today()) ? d.dates : [...d.dates, today()]));
    api.getShareFiles().then((d) => setTree(d.tree));

    const ws = connectChatSocket((msg) => {
      if (msg.type === "share_updated") api.getShareFiles().then((d) => setTree(d.tree));
      else if (msg.type === "error") alert(msg.message);
      else if (msg.type === "deleted") setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      else if (msg.type === "message" && msg.ts.slice(0, 10) === selectedDateRef.current) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  useEffect(() => {
    api.getMessages(selectedDate).then((d) => setMessages(d.messages));
  }, [selectedDate]);

  const { dragOver, sizeError, checkSize, dropHandlers } = useFileDrop({
    onImage: (b64) => sendImage(wsRef.current, b64, target),
    onFile: (b64, name) => sendFile(wsRef.current, b64, name, target),
  });

  return (
    <div className="chat-screen">
      <div className="top-bar">
        <span>MultiChat · {user.nickname}</span>
        <div className="top-bar-actions">
          <DateDropdown dates={dates} value={selectedDate} onChange={setSelectedDate} />
          <a className="button ghost small" href={api.exportUrl(selectedDate)}>MD 다운로드</a>
          <button className="button ghost small" onClick={onLogout}>나가기</button>
        </div>
      </div>
      <div className="chat-layout">
        <div className="sidebar">
          <h3>공유 파일</h3>
          <FileTree tree={tree} />
          <h3>받는 사람</h3>
          <label><input type="radio" checked={target === "admin"} onChange={() => setTarget("admin")} /> 강사</label>
          <label className="target-option"><input type="radio" checked={target === "all"} onChange={() => setTarget("all")} /> 전체 사용자</label>
        </div>
        <div className={`main-pane ${dragOver ? "drag-over" : ""}`} {...dropHandlers}>
          <MessageList
            messages={messages}
            myIdentifier={user.identifier}
            onDelete={(id, date) => deleteMessage(wsRef.current, id, date)}
          />
          {sizeError && <p className="error-text drop-error">{sizeError}</p>}
          <ChatInput
            onSendText={(text) => sendText(wsRef.current, text, target)}
            onSendImage={(b64) => sendImage(wsRef.current, b64, target)}
            onSendFile={(b64, name) => sendFile(wsRef.current, b64, name, target)}
            checkSize={checkSize}
          />
        </div>
      </div>
    </div>
  );
}
