import { Router } from "express";
import { requireAuth, requireAdmin } from "../auth.js";
import { broadcastToAll } from "../state.js";
import {
  validateSurveyInput,
  validateAnswers,
  createSurvey,
  getSurvey,
  listSurveys,
  submitResponse,
  setClosed,
  deleteSurvey,
  buildResults,
  publicSurvey,
} from "../surveyStore.js";

const router = Router();

// 설문 생성/마감/삭제/응답 시 전원에게 알림 — 클라이언트는 목록(배지)과 열려 있는 결과를 재조회한다.
function notify(id) {
  broadcastToAll({ type: "survey_updated", id });
}

function findOr404(req, res) {
  const survey = getSurvey(req.params.id);
  if (!survey) res.status(404).json({ error: "NOT_FOUND", message: "설문을 찾을 수 없습니다." });
  return survey;
}

router.get("/surveys", requireAuth, (req, res) => {
  const identifier = req.user.role === "student" ? req.user.identifier : null;
  res.json({ surveys: listSurveys(identifier) });
});

router.post("/surveys", requireAuth, requireAdmin, (req, res) => {
  const { value, error } = validateSurveyInput(req.body);
  if (error) return res.status(400).json({ error: "INVALID_SURVEY", message: error });
  const survey = createSurvey(value);
  notify(survey.id);
  res.status(201).json({ survey: publicSurvey(survey) });
});

// 설문 정의 + 결과 + (수강생이면) 내 응답을 한 번에.
router.get("/surveys/:id", requireAuth, (req, res) => {
  const survey = findOr404(req, res);
  if (!survey) return;
  const isAdmin = req.user.role === "admin";
  res.json({
    survey: publicSurvey(survey),
    results: buildResults(survey, { includeNames: isAdmin }),
    myAnswers: isAdmin ? null : survey.responses[req.user.identifier]?.answers ?? null,
  });
});

router.post("/surveys/:id/responses", requireAuth, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "FORBIDDEN", message: "수강생만 응답할 수 있습니다." });
  const survey = findOr404(req, res);
  if (!survey) return;
  if (survey.closed) return res.status(409).json({ error: "SURVEY_CLOSED", message: "마감된 설문입니다." });
  const { value, error } = validateAnswers(survey, req.body?.answers);
  if (error) return res.status(400).json({ error: "INVALID_ANSWERS", message: error });
  submitResponse(survey, req.user, value);
  notify(survey.id);
  res.json({ ok: true });
});

router.patch("/surveys/:id", requireAuth, requireAdmin, (req, res) => {
  const survey = findOr404(req, res);
  if (!survey) return;
  if (typeof req.body?.closed !== "boolean") return res.status(400).json({ error: "INVALID_BODY" });
  setClosed(survey, req.body.closed);
  notify(survey.id);
  res.json({ survey: publicSurvey(survey) });
});

router.delete("/surveys/:id", requireAuth, requireAdmin, (req, res) => {
  if (!deleteSurvey(req.params.id)) return res.status(404).json({ error: "NOT_FOUND", message: "설문을 찾을 수 없습니다." });
  notify(req.params.id);
  res.json({ ok: true });
});

export default router;
