// 사용자 세션은 비영속(docs/1-prd.md 접속/인증) — 프로세스 메모리에만 보관.
const sessions = new Map(); // identifier -> { identifier, nickname, role, ws }

// 강제 종료 시 기존 JWT를 무효화하기 위한 식별자별 세션 버전(docs/4-api.md 0항).
// ponytail: 프로세스 재시작 시 초기화되지만 JWT 시크릿도 메모리 한정이라 재시작하면 토큰 자체가 무효 — 영속화 불필요.
const sessionVersions = new Map(); // identifier -> number

export function getSessionVersion(identifier) {
  return sessionVersions.get(identifier) || 0;
}

export function bumpSessionVersion(identifier) {
  const next = getSessionVersion(identifier) + 1;
  sessionVersions.set(identifier, next);
  return next;
}

export function isIdentifierTaken(identifier) {
  return sessions.has(identifier);
}

export function addSession(session) {
  sessions.set(session.identifier, session);
}

export function removeSession(identifier) {
  sessions.delete(identifier);
}

export function getSession(identifier) {
  return sessions.get(identifier);
}

export function listStudents() {
  return [...sessions.values()].filter((s) => s.role === "student");
}

function admins() {
  return [...sessions.values()].filter((s) => s.role === "admin");
}

function send(session, payload) {
  if (session.ws && session.ws.readyState === session.ws.OPEN) {
    session.ws.send(JSON.stringify(payload));
  }
}

export function sendToIdentifier(identifier, payload) {
  const session = sessions.get(identifier);
  if (session) send(session, payload);
}

export function broadcastToAdmins(payload) {
  for (const admin of admins()) send(admin, payload);
}

export function broadcastToAll(payload) {
  for (const session of sessions.values()) send(session, payload);
}

export function userListPayload() {
  return {
    type: "user_list",
    users: listStudents().map((s) => ({ nickname: s.nickname, identifier: s.identifier })),
  };
}

// 관리자가 지정한 공유 디렉토리 절대경로. 미지정 시 null.
export const shareState = { root: null };
