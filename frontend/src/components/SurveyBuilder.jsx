import { useState } from "react";
import { api } from "../api.js";

// React key용 로컬 일련번호(crypto.randomUUID는 http LAN 접속 같은 비보안 컨텍스트에선 없음).
let keySeq = 0;
const nextKey = () => ++keySeq;
const newChoiceQuestion = () => ({ key: nextKey(), type: "choice", text: "", options: ["", ""], multiple: false });
const newTextQuestion = () => ({ key: nextKey(), type: "text", text: "" });

// 강사용 설문 작성 폼: 질문을 하나씩 추가하고, 질문마다 유형(다지선다/단답형)·내용·선택지를 입력.
export default function SurveyBuilder({ onCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([newChoiceQuestion()]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(key, patch) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  function changeType(q, type) {
    if (type === q.type) return;
    // 입력해둔 질문 내용은 유지하고 유형별 필드만 바꾼다.
    const base = type === "choice" ? newChoiceQuestion() : newTextQuestion();
    update(q.key, { ...base, key: q.key, text: q.text });
  }

  function move(index, delta) {
    setQuestions((qs) => {
      const next = [...qs];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  }

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        title,
        questions: questions.map(({ type, text, options, multiple }) =>
          type === "choice" ? { type, text, options, multiple } : { type, text },
        ),
      };
      const { survey } = await api.createSurvey(payload);
      onCreated(survey.id);
    } catch (e) {
      setError(e.data?.message || "설문 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="survey-builder">
      <label className="survey-label">설문 제목</label>
      <input className="survey-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 1일차 강의 만족도" maxLength={200} />

      {questions.map((q, i) => (
        <div key={q.key} className="survey-question-edit">
          <div className="survey-question-head">
            <strong>Q{i + 1}</strong>
            <select className="survey-select" value={q.type} onChange={(e) => changeType(q, e.target.value)}>
              <option value="choice">다지선다</option>
              <option value="text">단답형</option>
            </select>
            <div className="survey-question-tools">
              <button type="button" className="icon-btn" title="위로" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
              <button type="button" className="icon-btn" title="아래로" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>▼</button>
              <button
                type="button"
                className="icon-btn danger"
                title="질문 삭제"
                disabled={questions.length === 1}
                onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
              >✕</button>
            </div>
          </div>
          <input
            className="survey-input"
            value={q.text}
            onChange={(e) => update(q.key, { text: e.target.value })}
            placeholder="질문 내용"
            maxLength={500}
          />
          {q.type === "choice" && (
            <>
              {q.options.map((opt, oi) => (
                <div key={oi} className="survey-option-edit">
                  <span className="survey-option-num">{oi + 1}.</span>
                  <input
                    className="survey-input"
                    value={opt}
                    onChange={(e) => update(q.key, { options: q.options.map((o, j) => (j === oi ? e.target.value : o)) })}
                    placeholder={`선택지 ${oi + 1}`}
                    maxLength={200}
                  />
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="선택지 삭제"
                    disabled={q.options.length <= 2}
                    onClick={() => update(q.key, { options: q.options.filter((_, j) => j !== oi) })}
                  >✕</button>
                </div>
              ))}
              <div className="survey-option-actions">
                <button
                  type="button"
                  className="link-btn"
                  disabled={q.options.length >= 20}
                  onClick={() => update(q.key, { options: [...q.options, ""] })}
                >＋ 선택지 추가</button>
                <label className="survey-check">
                  <input type="checkbox" checked={q.multiple} onChange={(e) => update(q.key, { multiple: e.target.checked })} />
                  복수 선택 허용
                </label>
              </div>
            </>
          )}
        </div>
      ))}

      <div className="survey-add-question">
        <button type="button" className="button ghost-dark small" disabled={questions.length >= 50} onClick={() => setQuestions((qs) => [...qs, newChoiceQuestion()])}>
          ＋ 다지선다 질문
        </button>
        <button type="button" className="button ghost-dark small" disabled={questions.length >= 50} onClick={() => setQuestions((qs) => [...qs, newTextQuestion()])}>
          ＋ 단답형 질문
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="survey-footer">
        <button type="button" className="button ghost-dark small" onClick={onCancel}>취소</button>
        <button type="button" className="button small" disabled={submitting} onClick={submit}>설문 등록</button>
      </div>
    </div>
  );
}
