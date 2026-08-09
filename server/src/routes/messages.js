import { Router } from "express";
import { requireAuth } from "../auth.js";
import { listDates, readMessages, filterForStudent, toMarkdown } from "../messageStore.js";

const router = Router();

function messagesForUser(date, user) {
  const all = readMessages(date);
  return user.role === "student" ? filterForStudent(all, user.identifier) : all;
}

router.get("/messages/dates", requireAuth, (req, res) => {
  const dates = listDates();
  if (req.user.role !== "student") return res.json({ dates });
  const withMine = dates.filter((d) => messagesForUser(d, req.user).length > 0);
  res.json({ dates: withMine });
});

router.get("/messages", requireAuth, (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "MISSING_DATE" });
  res.json({ date, messages: messagesForUser(date, req.user) });
});

router.get("/messages/export", requireAuth, (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "MISSING_DATE" });
  const md = toMarkdown(date, messagesForUser(date, req.user));
  res.set("Content-Type", "text/markdown; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="${date}.md"`);
  res.send(md);
});

export default router;
