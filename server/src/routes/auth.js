import { Router } from "express";
import crypto from "node:crypto";
import { ADMIN_PASSWORD, STUDENT_PASSWORD } from "../env.js";
import { passwordMatches, issueToken } from "../auth.js";
import { isIdentifierTaken, getSessionVersion } from "../state.js";

const router = Router();

router.post("/login/admin", (req, res) => {
  const { password } = req.body || {};
  if (!passwordMatches(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "INVALID_PASSWORD" });
  }
  const identifier = `admin-${crypto.randomUUID()}`;
  const token = issueToken({ role: "admin", identifier, nickname: "강사", sessionVersion: getSessionVersion(identifier) });
  res.json({ token, role: "admin", identifier, nickname: "강사" });
});

router.post("/login/student", (req, res) => {
  const { nickname, identifier, password } = req.body || {};
  if (!nickname || !identifier || !password) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }
  // 예약 이름 차단은 trim 후 완전 일치만 본다(docs/1-prd.md).
  if (nickname.trim() === "강사" || identifier.trim() === "강사") {
    return res.status(400).json({ error: "RESERVED_NAME" });
  }
  if (!passwordMatches(password, STUDENT_PASSWORD)) {
    return res.status(401).json({ error: "INVALID_PASSWORD" });
  }
  if (isIdentifierTaken(identifier)) {
    return res.status(409).json({ error: "IDENTIFIER_TAKEN" });
  }
  const token = issueToken({ role: "student", identifier, nickname, sessionVersion: getSessionVersion(identifier) });
  res.json({ token, role: "student", nickname, identifier });
});

export default router;
