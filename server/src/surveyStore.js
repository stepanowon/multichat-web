import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { formatKst } from "./time.js";
import { sanitizeFileName } from "./sanitize.js";

// 설문은 날짜와 무관하게 강의 전체에서 누적되므로 단일 JSON 파일로 보관(규모상 통째 읽기/쓰기로 충분).
// 구조: { surveys: [{ id, title, createdAt, closed, questions: [...], responses: { <identifier>: {...} } }] }
const dataDir = path.join(import.meta.dirname, "../data");
const surveyFile = path.join(dataDir, "surveys.json");

const LIMITS = {
  title: 200,
  questions: 50,
  questionText: 500,
  options: 20,
  optionText: 200,
  textAnswer: 1000,
};

let surveys = load();

function load() {
  let raw;
  try {
    raw = fs.readFileSync(surveyFile, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") console.error("[survey] 파일 읽기 실패:", err.message);
    return [];
  }
  try {
    return JSON.parse(raw).surveys || [];
  } catch (err) {
    // 깨진 파일을 빈 목록으로 덮어쓰면 기존 설문이 영구 유실되므로 옆에 보존해두고 시작한다.
    const backup = `${surveyFile}.corrupt-${Date.now()}`;
    fs.copyFileSync(surveyFile, backup);
    console.error(`[survey] 파일 파싱 실패(${err.message}) — ${backup} 로 보존 후 빈 목록으로 시작`);
    return [];
  }
}

// 쓰는 도중 프로세스가 죽어도 파일이 반쯤 써진 상태로 남지 않도록 임시파일 → rename.
function save() {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${surveyFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ surveys }, null, 2), "utf8");
  fs.renameSync(tmp, surveyFile);
}

const isNonEmptyString = (v, max) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;

// 강사가 보낸 설문 정의를 검증·정규화. 실패 시 { error: "사람이 읽을 메시지" }.
export function validateSurveyInput(body) {
  const { title, questions } = body || {};
  if (!isNonEmptyString(title, LIMITS.title)) return { error: `설문 제목을 입력하세요(최대 ${LIMITS.title}자).` };
  if (!Array.isArray(questions) || questions.length === 0) return { error: "질문을 1개 이상 추가하세요." };
  if (questions.length > LIMITS.questions) return { error: `질문은 최대 ${LIMITS.questions}개까지 가능합니다.` };

  const normalized = [];
  for (const [i, q] of questions.entries()) {
    const n = i + 1;
    if (!q || (q.type !== "choice" && q.type !== "text")) return { error: `${n}번 질문의 유형이 올바르지 않습니다.` };
    if (!isNonEmptyString(q.text, LIMITS.questionText)) return { error: `${n}번 질문 내용을 입력하세요(최대 ${LIMITS.questionText}자).` };
    const question = { id: crypto.randomUUID(), type: q.type, text: q.text.trim() };
    if (q.type === "choice") {
      if (!Array.isArray(q.options)) return { error: `${n}번 질문의 선택지가 올바르지 않습니다.` };
      if (q.options.some((o) => !isNonEmptyString(o, LIMITS.optionText))) {
        return { error: `${n}번 질문에 비어 있는 선택지가 있습니다(최대 ${LIMITS.optionText}자).` };
      }
      if (q.options.length < 2 || q.options.length > LIMITS.options) {
        return { error: `${n}번 질문의 선택지는 2~${LIMITS.options}개여야 합니다.` };
      }
      question.options = q.options.map((o) => o.trim());
      question.multiple = q.multiple === true;
    }
    normalized.push(question);
  }
  return { value: { title: title.trim(), questions: normalized } };
}

// 수강생 응답 검증. answers[i]는 i번 질문의 답: 다지선다 → 선택지 인덱스 배열, 단답형 → 문자열.
export function validateAnswers(survey, answers) {
  if (!Array.isArray(answers) || answers.length !== survey.questions.length) {
    return { error: "모든 질문에 답해주세요." };
  }
  const normalized = [];
  for (const [i, q] of survey.questions.entries()) {
    const a = answers[i];
    const n = i + 1;
    if (q.type === "choice") {
      if (Array.isArray(a) && a.length === 0) return { error: `${n}번 질문의 답을 선택하세요.` };
      const valid =
        Array.isArray(a) &&
        a.length > 0 &&
        a.every((idx) => Number.isInteger(idx) && idx >= 0 && idx < q.options.length) &&
        new Set(a).size === a.length &&
        (q.multiple || a.length === 1);
      if (!valid) return { error: `${n}번 질문의 선택이 올바르지 않습니다.` };
      normalized.push([...a].sort((x, y) => x - y));
    } else {
      if (!isNonEmptyString(a, LIMITS.textAnswer)) return { error: `${n}번 질문에 답을 입력하세요(최대 ${LIMITS.textAnswer}자).` };
      normalized.push(a.trim());
    }
  }
  return { value: normalized };
}

export function createSurvey({ title, questions }) {
  const survey = {
    id: crypto.randomUUID(),
    title,
    createdAt: new Date().toISOString(),
    closed: false,
    questions,
    responses: {},
  };
  surveys.push(survey);
  save();
  return survey;
}

export function getSurvey(id) {
  return surveys.find((s) => s.id === id) || null;
}

export function listSurveys(identifier) {
  return [...surveys]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      closed: s.closed,
      questionCount: s.questions.length,
      responseCount: Object.keys(s.responses).length,
      answered: identifier ? Boolean(s.responses[identifier]) : false,
    }));
}

// 같은 수강생이 다시 제출하면 덮어쓴다(마감 전까지 수정 가능).
export function submitResponse(survey, { identifier, nickname }, answers) {
  survey.responses[identifier] = { nickname, answers, submittedAt: new Date().toISOString() };
  save();
}

export function setClosed(survey, closed) {
  survey.closed = closed;
  save();
}

export function deleteSurvey(id) {
  const before = surveys.length;
  surveys = surveys.filter((s) => s.id !== id);
  if (surveys.length === before) return false;
  save();
  return true;
}

// 결과 집계. 수강생에게는 익명 집계만, 강사에게는 응답자 이름까지 포함한다.
export function buildResults(survey, { includeNames }) {
  const responses = Object.values(survey.responses).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  return {
    responseCount: responses.length,
    questions: survey.questions.map((q, i) => {
      if (q.type === "choice") {
        const chosenBy = q.options.map((_, oi) => responses.filter((r) => r.answers[i].includes(oi)));
        return {
          counts: chosenBy.map((rs) => rs.length),
          ...(includeNames && { voters: chosenBy.map((rs) => rs.map((r) => r.nickname)) }),
        };
      }
      return {
        answers: responses.map((r) => (includeNames ? { text: r.answers[i], nickname: r.nickname } : { text: r.answers[i] })),
      };
    }),
  };
}

// 사용자 입력이 Markdown 구조(표 셀 구분자, 줄바꿈, 제목/목록 기호)를 깨지 않도록 한 줄로 정리.
function mdInline(text) {
  return String(text).replace(/\r?\n/g, " ").replace(/\|/g, "\\|").replace(/^([#>*+-]|\d+\.)/, "\\$1");
}

// 결과를 Markdown으로. includeNames 규칙은 화면 결과(buildResults)와 동일 — 수강생은 익명 집계만.
export function surveyToMarkdown(survey, { includeNames }) {
  const results = buildResults(survey, { includeNames });
  const lines = [
    `# 설문 결과: ${mdInline(survey.title)}`,
    "",
    `- 상태: ${survey.closed ? "마감" : "진행 중"}`,
    `- 등록: ${formatKst(survey.createdAt)} (KST)`,
    `- 응답: ${results.responseCount}명`,
    `- 내보낸 시각: ${formatKst(Date.now())} (KST)`,
    "",
  ];

  survey.questions.forEach((q, i) => {
    const result = results.questions[i];
    const kind = q.type === "choice" ? (q.multiple ? "다지선다, 복수 선택" : "다지선다") : "단답형";
    lines.push(`## Q${i + 1}. ${mdInline(q.text)} (${kind})`, "");

    if (q.type === "choice") {
      lines.push(includeNames ? "| 선택지 | 응답 수 | 비율 | 응답자 |" : "| 선택지 | 응답 수 | 비율 |");
      lines.push(includeNames ? "|---|---:|---:|---|" : "|---|---:|---:|");
      q.options.forEach((opt, oi) => {
        const count = result.counts[oi];
        const pct = results.responseCount ? Math.round((count / results.responseCount) * 100) : 0;
        const row = [mdInline(opt), `${count}`, `${pct}%`];
        if (includeNames) row.push(result.voters[oi].map(mdInline).join(", "));
        lines.push(`| ${row.join(" | ")} |`);
      });
    } else if (result.answers.length === 0) {
      lines.push("_응답 없음_");
    } else {
      for (const a of result.answers) {
        lines.push(a.nickname ? `- **${mdInline(a.nickname)}**: ${mdInline(a.text)}` : `- ${mdInline(a.text)}`);
      }
    }
    lines.push("");
  });
  return lines.join("\n");
}

// 다운로드 파일명: 파일시스템에서 문제되는 문자만 걷어낸 설문 제목(최대 80자).
export function surveyExportFileName(survey) {
  return `설문결과_${sanitizeFileName(survey.title, "survey").slice(0, 80)}.md`;
}

// 응답 내역(responses)은 외부로 그대로 내보내지 않는다 — 질문 정의만.
export function publicSurvey(survey) {
  const { responses, ...rest } = survey;
  return rest;
}
