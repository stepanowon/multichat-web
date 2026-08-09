import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./env.js";

// 길이가 다르면 timingSafeEqual이 즉시 던지므로 먼저 길이를 맞춘다.
export function passwordMatches(input, expected) {
  const a = Buffer.from(String(input ?? ""));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function issueToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET); // 실패 시 throw
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  // 다운로드/내보내기 링크는 <a href>로 직접 열려 헤더를 못 붙이므로 쿼리 토큰도 허용.
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : req.query.token || null;
  if (!token) return res.status(401).json({ error: "INVALID_TOKEN" });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "FORBIDDEN" });
  next();
}
