import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

function emptyAnswers(survey) {
  return survey.questions.map((q) => (q.type === "choice" ? [] : ""));
}

// 설문 상세: (수강생) 응답 폼 + 결과, (강사) 결과(응답자 이름 포함) + 마감/삭제.
// version이 바뀔 때마다(survey_updated 수신) 결과를 재조회해 실시간 반영한다.
export default function SurveyDetail({ id, version, isAdmin, onBack }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 응답 폼은 설문을 처음 열 때만 채운다 — 다른 사람 응답으로 재조회될 때 작성 중인 답이 덮이지 않도록.
  const initializedFor = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.getSurvey(id)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoadError("");
        if (initializedFor.current !== id) {
          initializedFor.current = id;
          setAnswers(d.myAnswers ?? emptyAnswers(d.survey));
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.status === 404 ? "삭제된 설문입니다." : "설문을 불러오지 못했습니다.");
      });
    return () => { cancelled = true; };
  }, [id, version]);

  if (loadError) {
    return (
      <div>
        <p className="error-text">{loadError}</p>
        <button className="button ghost-dark small" onClick={onBack}>목록으로</button>
      </div>
    );
  }
  if (!data || !answers) return <p className="hint-text">불러오는 중...</p>;

  const { survey, results, myAnswers } = data;
  const canAnswer = !isAdmin && !survey.closed;

  function setAnswer(i, value) {
    setAnswers((prev) => prev.map((a, j) => (j === i ? value : a)));
  }

  function toggleChoice(i, q, optionIndex) {
    const current = answers[i];
    if (!q.multiple) return setAnswer(i, [optionIndex]);
    setAnswer(i, current.includes(optionIndex) ? current.filter((x) => x !== optionIndex) : [...current, optionIndex]);
  }

  async function submit() {
    setSubmitError("");
    setNotice("");
    setSubmitting(true);
    try {
      await api.submitSurvey(survey.id, answers);
      setNotice(myAnswers ? "응답을 수정했습니다." : "응답을 제출했습니다.");
    } catch (e) {
      setSubmitError(e.data?.message || "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleClosed() {
    try {
      await api.setSurveyClosed(survey.id, !survey.closed);
    } catch {
      alert("상태 변경에 실패했습니다.");
    }
  }

  async function remove() {
    if (!confirm(`"${survey.title}" 설문을 삭제하시겠습니까? 응답도 모두 삭제됩니다.`)) return;
    try {
      await api.deleteSurvey(survey.id);
      onBack();
    } catch {
      alert("삭제에 실패했습니다.");
    }
  }

  return (
    <div className="survey-detail">
      <div className="survey-detail-head">
        <button className="link-btn" onClick={onBack}>← 목록</button>
        <span className={`survey-status ${survey.closed ? "closed" : "open"}`}>{survey.closed ? "마감" : "진행 중"}</span>
      </div>
      <h3 className="survey-title">{survey.title}</h3>
      <p className="hint-text">응답 {results.responseCount}명</p>

      <div className="survey-admin-actions">
        {isAdmin && (
          <>
            <button className="button ghost-dark small" onClick={toggleClosed}>{survey.closed ? "다시 열기" : "마감하기"}</button>
            <button className="button ghost-dark small danger" onClick={remove}>삭제</button>
          </>
        )}
        <a
          className="button ghost-dark small"
          href={api.surveyExportUrl(survey.id)}
          title={isAdmin ? "응답자 이름 포함" : "익명 집계"}
        >결과 MD 다운로드</a>
      </div>

      {canAnswer && (
        <section className="survey-section">
          <h4>{myAnswers ? "내 응답 (마감 전까지 수정 가능)" : "응답하기"}</h4>
          {survey.questions.map((q, i) => (
            <div key={q.id} className="survey-question">
              <div className="survey-question-text">
                Q{i + 1}. {q.text}
                {q.type === "choice" && q.multiple && <span className="survey-tag">복수 선택</span>}
              </div>
              {q.type === "choice" ? (
                q.options.map((opt, oi) => (
                  <label key={oi} className="survey-check">
                    <input
                      type={q.multiple ? "checkbox" : "radio"}
                      name={`q-${q.id}`}
                      checked={answers[i].includes(oi)}
                      onChange={() => toggleChoice(i, q, oi)}
                    />
                    {opt}
                  </label>
                ))
              ) : (
                <input
                  className="survey-input"
                  value={answers[i]}
                  onChange={(e) => setAnswer(i, e.target.value)}
                  placeholder="답변 입력"
                  maxLength={1000}
                />
              )}
            </div>
          ))}
          {submitError && <p className="error-text">{submitError}</p>}
          {notice && <p className="success-text">{notice}</p>}
          <div className="survey-footer">
            <button className="button small" disabled={submitting} onClick={submit}>{myAnswers ? "응답 수정" : "제출"}</button>
          </div>
        </section>
      )}
      {!isAdmin && survey.closed && myAnswers === null && <p className="hint-text">마감된 설문이라 응답할 수 없습니다.</p>}

      <section className="survey-section">
        <h4>결과{!isAdmin && " (익명)"}</h4>
        {survey.questions.map((q, i) => (
          <div key={q.id} className="survey-question">
            <div className="survey-question-text">Q{i + 1}. {q.text}</div>
            {q.type === "choice" ? (
              <ChoiceResult q={q} result={results.questions[i]} total={results.responseCount} mine={myAnswers?.[i]} />
            ) : (
              <TextResult result={results.questions[i]} />
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function ChoiceResult({ q, result, total, mine }) {
  return (
    <ul className="survey-bars">
      {q.options.map((opt, oi) => {
        const count = result.counts[oi];
        const pct = total ? Math.round((count / total) * 100) : 0;
        return (
          <li key={oi}>
            <div className="survey-bar-label">
              <span>{opt}{mine?.includes(oi) && <span className="survey-tag">내 선택</span>}</span>
              <span className="survey-bar-count">{count}명 · {pct}%</span>
            </div>
            <div className="survey-bar-track"><div className="survey-bar-fill" style={{ width: `${pct}%` }} /></div>
            {result.voters?.[oi]?.length > 0 && <div className="survey-voters">{result.voters[oi].join(", ")}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function TextResult({ result }) {
  if (result.answers.length === 0) return <p className="hint-text">아직 응답이 없습니다.</p>;
  return (
    <ul className="survey-text-answers">
      {result.answers.map((a, i) => (
        <li key={i}>
          {a.nickname && <span className="survey-answer-name">{a.nickname}</span>}
          {a.text}
        </li>
      ))}
    </ul>
  );
}
