import { useState } from "react";
import SurveyBuilder from "./SurveyBuilder.jsx";
import SurveyDetail from "./SurveyDetail.jsx";

function formatDate(iso) {
  return new Date(iso).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// 설문 모달: 목록 → (강사) 새 설문 작성 / 설문 상세(응답·결과).
export default function SurveyPanel({ surveys, version, isAdmin, onClose }) {
  const [view, setView] = useState({ name: "list" }); // { name: "list" | "create" } | { name: "detail", id }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="survey-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>설문</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="survey-body">
          {view.name === "create" && (
            <SurveyBuilder
              onCreated={(id) => setView({ name: "detail", id })}
              onCancel={() => setView({ name: "list" })}
            />
          )}
          {view.name === "detail" && (
            <SurveyDetail id={view.id} version={version} isAdmin={isAdmin} onBack={() => setView({ name: "list" })} />
          )}
          {view.name === "list" && (
            <>
              {isAdmin && (
                <button className="button small survey-new-btn" onClick={() => setView({ name: "create" })}>＋ 새 설문 만들기</button>
              )}
              {surveys.length === 0 ? (
                <p className="hint-text">등록된 설문이 없습니다.</p>
              ) : (
                <ul className="survey-list">
                  {surveys.map((s) => (
                    <li key={s.id}>
                      <button className="survey-list-item" onClick={() => setView({ name: "detail", id: s.id })}>
                        <span className="survey-list-title">
                          {s.title}
                          {!isAdmin && !s.closed && !s.answered && <span className="survey-tag new">미응답</span>}
                          {!isAdmin && s.answered && <span className="survey-tag">응답함</span>}
                        </span>
                        <span className="survey-list-meta">
                          <span className={`survey-status ${s.closed ? "closed" : "open"}`}>{s.closed ? "마감" : "진행 중"}</span>
                          질문 {s.questionCount} · 응답 {s.responseCount}명 · {formatDate(s.createdAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
