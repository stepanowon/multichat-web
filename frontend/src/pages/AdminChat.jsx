import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { connectChatSocket, sendText, sendImage, sendFile, deleteMessage } from "../ws.js";
import DateDropdown from "../components/DateDropdown.jsx";
import MessageList from "../components/MessageList.jsx";
import ChatInput from "../components/ChatInput.jsx";
import ShareDirModal from "../components/ShareDirModal.jsx";
import { useFileDrop } from "../useFileDrop.js";
import { copyText } from "../clipboard.js";

const today = () => new Date().toISOString().slice(0, 10);

export default function AdminChat({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [target, setTarget] = useState("all");
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [messages, setMessages] = useState([]);
  const [shareRoot, setShareRoot] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [toasts, setToasts] = useState([]); // 입퇴장 알림: 대화창에 누적하지 않고 잠깐 떴다 사라짐
  const wsRef = useRef(null);

  function pushToast(msg) {
    const id = crypto.randomUUID();
    const text = `${msg.nickname}님이 ${msg.event === "join" ? "입장" : "퇴장"}했습니다`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }

  useEffect(() => {
    api.getDates().then((d) => setDates(d.dates.includes(today()) ? d.dates : [...d.dates, today()]));
    api.getShareFiles().then((d) => setShareRoot(d.root));
    api.getServerInfo().then(setServerInfo).catch(() => setServerInfo({ port: "", addresses: [], protocol: "http" }));

    const ws = connectChatSocket((msg) => {
      if (msg.type === "user_list") setUsers(msg.users);
      else if (msg.type === "share_updated") api.getShareFiles().then((d) => setShareRoot(d.root));
      else if (msg.type === "error") alert(msg.message);
      else if (msg.type === "deleted") setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      else if (msg.type === "system") pushToast(msg);
      else if (msg.type === "message") {
        setMessages((prev) => (msg.ts.slice(0, 10) === selectedDateRef.current ? [...prev, msg] : prev));
      }
    });
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  // ws 콜백 클로저가 최신 selectedDate를 참조하도록 ref로 보관.
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  useEffect(() => {
    // system(입퇴장) 로그는 MD 내보내기용으로만 서버에 남기고, 화면 목록에는 누적하지 않는다.
    api.getMessages(selectedDate).then((d) => setMessages(d.messages.filter((m) => m.type !== "system")));
  }, [selectedDate]);

  const { dragOver, sizeError, checkSize, dropHandlers } = useFileDrop({
    onImage: (b64) => sendImage(wsRef.current, b64, target),
    onFile: (b64, name) => sendFile(wsRef.current, b64, name, target),
  });

  return (
    <div className="chat-screen">
      <div className="top-bar">
        <span>MultiChat · 강사 모드</span>
        <div className="top-bar-actions">
          <DateDropdown dates={dates} value={selectedDate} onChange={setSelectedDate} />
          <a className="button ghost small" href={api.exportUrl(selectedDate)}>MD 다운로드</a>
          <button className="button ghost small" onClick={onLogout}>나가기</button>
        </div>
      </div>
      <div className="chat-layout">
        <div className="sidebar">
          <h3>수강생 접속 주소</h3>
          <p className="hint-text">수강생들은 아래 주소를 브라우저에 입력해 접속합니다.</p>
          {serverInfo?.addresses.length ? (
            <ul className="server-addr-list">
              {serverInfo.addresses.map((ip) => (
                <li key={ip}>
                  <code>{serverInfo.protocol}://{ip}:{serverInfo.port}</code>
                  <button
                    className="copy-btn"
                    title="복사"
                    onClick={() => copyText(`${serverInfo.protocol}://${ip}:${serverInfo.port}`)}
                  >⧉</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint-text">
              {serverInfo ? "접속 가능한 주소를 찾지 못했습니다." : "주소 확인 중..."}
            </p>
          )}
          <h3>접속자 ({users.length})</h3>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.identifier}><span className="online-dot" />{u.nickname}</li>
            ))}
          </ul>
          <h3>받는 사람</h3>
          <label><input type="radio" checked={target === "all"} onChange={() => setTarget("all")} /> 전체</label>
          {users.map((u) => (
            <label key={u.identifier} className="target-option">
              <input type="radio" checked={target === u.identifier} onChange={() => setTarget(u.identifier)} /> {u.nickname}
            </label>
          ))}
          <button className="button ghost small share-btn" onClick={() => setShowShareModal(true)}>공유 폴더 지정</button>
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
      {showShareModal && (
        <ShareDirModal currentRoot={shareRoot} onClose={() => setShowShareModal(false)} onUpdated={setShareRoot} />
      )}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.text}</div>
        ))}
      </div>
    </div>
  );
}
