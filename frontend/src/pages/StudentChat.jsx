import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useChatRoom } from "../useChatRoom.js";
import { useSurveys } from "../useSurveys.js";
import ChatTopBar from "../components/ChatTopBar.jsx";
import ChatPane from "../components/ChatPane.jsx";
import FileTree from "../components/FileTree.jsx";
import SurveyPanel from "../components/SurveyPanel.jsx";

export default function StudentChat({ user, onLogout }) {
  const [tree, setTree] = useState([]);
  const [target, setTarget] = useState("all"); // "all" | "admin"
  const [showSurveys, setShowSurveys] = useState(false);
  const { surveys, version: surveyVersion, refresh: refreshSurveys } = useSurveys();
  // 아직 응답하지 않은 진행 중 설문 수 — 상단 버튼에 배지로 표시해 새 설문을 놓치지 않게.
  const pendingSurveys = surveys.filter((s) => !s.closed && !s.answered).length;

  const loadTree = () => api.getShareFiles().then((d) => setTree(d.tree));

  const chat = useChatRoom((msg) => {
    if (msg.type === "share_updated") loadTree();
    else if (msg.type === "survey_updated") refreshSurveys();
  });

  useEffect(() => { loadTree(); }, []);

  return (
    <div className="chat-screen">
      <ChatTopBar title={`MultiChat · ${user.nickname}`} chat={chat} onLogout={onLogout}>
        <button className="button ghost small" onClick={() => setShowSurveys(true)}>
          설문{pendingSurveys > 0 && <span className="badge-count">{pendingSurveys}</span>}
        </button>
      </ChatTopBar>
      <div className="chat-layout">
        <div className="sidebar">
          <h3>공유 파일</h3>
          <FileTree tree={tree} />
          <h3>받는 사람</h3>
          <label><input type="radio" checked={target === "admin"} onChange={() => setTarget("admin")} /> 강사</label>
          <label className="target-option"><input type="radio" checked={target === "all"} onChange={() => setTarget("all")} /> 전체 사용자</label>
        </div>
        <ChatPane chat={chat} myIdentifier={user.identifier} target={target} />
      </div>
      {showSurveys && (
        <SurveyPanel surveys={surveys} version={surveyVersion} isAdmin={false} onClose={() => setShowSurveys(false)} />
      )}
    </div>
  );
}
