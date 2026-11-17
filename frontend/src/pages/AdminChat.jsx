import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useChatRoom } from "../useChatRoom.js";
import { useSurveys } from "../useSurveys.js";
import ChatTopBar from "../components/ChatTopBar.jsx";
import ChatPane from "../components/ChatPane.jsx";
import ServerAddressList from "../components/ServerAddressList.jsx";
import ShareDirModal from "../components/ShareDirModal.jsx";
import SurveyPanel from "../components/SurveyPanel.jsx";

// 토스트 key용 일련번호(crypto.randomUUID는 http LAN 접속 같은 비보안 컨텍스트에선 없음).
let toastSeq = 0;

export default function AdminChat() {
  const [users, setUsers] = useState([]);
  const [target, setTarget] = useState("all");
  const [shareRoot, setShareRoot] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSurveys, setShowSurveys] = useState(false);
  const [toasts, setToasts] = useState([]); // 입퇴장 알림: 대화창에 누적하지 않고 잠깐 떴다 사라짐
  const { surveys, version: surveyVersion, refresh: refreshSurveys } = useSurveys();

  const loadShareRoot = () => api.getShareFiles().then((d) => setShareRoot(d.root));

  function pushToast({ nickname, event }) {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, text: `${nickname}님이 ${event === "join" ? "입장" : "퇴장"}했습니다` }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }

  const chat = useChatRoom((msg) => {
    if (msg.type === "user_list") setUsers(msg.users);
    else if (msg.type === "system") pushToast(msg);
    else if (msg.type === "share_updated") loadShareRoot();
    else if (msg.type === "survey_updated") refreshSurveys();
  });

  useEffect(() => { loadShareRoot(); }, []);

  // 받는 사람으로 선택된 학생이 퇴장/강제종료로 목록에서 사라지면 드롭다운이 빈 값을 가리키게 되니 전체로 되돌린다.
  useEffect(() => {
    if (target !== "all" && !users.some((u) => u.identifier === target)) setTarget("all");
  }, [users, target]);

  function kick(u) {
    if (confirm(`${u.nickname}님의 연결을 강제로 종료하시겠습니까?`)) chat.kickUser(u.identifier);
  }

  return (
    <div className="chat-screen">
      <ChatTopBar title="MultiChat · 강사 모드" chat={chat}>
        <button className="button ghost small" onClick={() => setShowSurveys(true)}>
          설문{surveys.length > 0 && ` (${surveys.length})`}
        </button>
      </ChatTopBar>
      <div className="chat-layout">
        <div className="sidebar">
          <h3>수강생 접속 주소</h3>
          <p className="hint-text">수강생들은 아래 주소를 브라우저에 입력해 접속합니다.</p>
          <ServerAddressList />
          <h3>접속자 ({users.length})</h3>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.identifier}>
                <span className="online-dot" />
                <span className="user-list-name">{u.nickname}</span>
                <button className="kick-btn" title="연결 끊기" onClick={() => kick(u)}>✕</button>
              </li>
            ))}
          </ul>
          <h3>받는 사람</h3>
          <select className="target-dropdown" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="all">전체</option>
            {users.map((u) => (
              <option key={u.identifier} value={u.identifier}>{u.nickname}</option>
            ))}
          </select>
          <button className="button ghost small share-btn" onClick={() => setShowShareModal(true)}>공유 폴더 지정</button>
        </div>
        <ChatPane chat={chat} target={target} />
      </div>
      {showSurveys && (
        <SurveyPanel surveys={surveys} version={surveyVersion} onClose={() => setShowSurveys(false)} />
      )}
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
