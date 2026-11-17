import { Router } from "express";
import { requireAuth } from "../auth.js";
import { listDates, readMessages, filterForStudent, toMarkdown, isValidDate } from "../messageStore.js";

const router = Router();

function messagesForUser(date, user) {
  const all = readMessages(date);
  return user.role === "student" ? filterForStudent(all, user.identifier) : all;
}

// ?date= 쿼리 필수 + YYYY-MM-DD 형식 검증(경로에 그대로 들어가므로).
function requireDate(req, res, next) {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "MISSING_DATE" });
  if (!isValidDate(date)) return res.status(400).json({ error: "INVALID_DATE" });
  next();
}

router.get("/messages/dates", requireAuth, (req, res) => {
  const dates = listDates();
  if (req.user.role !== "student") return res.json({ dates });
  const withMine = dates.filter((d) => messagesForUser(d, req.user).length > 0);
  res.json({ dates: withMine });
});

router.get("/messages", requireAuth, requireDate, (req, res) => {
  const { date } = req.query;
  res.json({ date, messages: messagesForUser(date, req.user) });
});

router.get("/messages/export", requireAuth, requireDate, (req, res) => {
  const { date } = req.query;
  res.attachment(`${date}.md`);
  res.type("text/markdown; charset=utf-8");
  res.send(toMarkdown(date, messagesForUser(date, req.user)));
});

export default router;
