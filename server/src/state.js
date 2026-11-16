// 사용자 세션은 비영속(docs/1-prd.md 접속/인증) — 프로세스 메모리에만 보관.
// 식별자가 아니라 "WS 연결" 단위로 보관한다. 식별자당 하나만 담으면 같은 토큰으로 연결이 둘 생기는
// 경우(강사 탭 복제, 새로고침·재연결 때 옛 소켓 close가 늦게 도착)에 한쪽이 다른 쪽 세션을
// 덮어쓰거나 지워서, 연결은 살아 있는데 브로드캐스트를 못 받는 화면이 생긴다.
// 수강생은 접속 시 식별자 중복을 막으므로(4409) 실제로 여러 연결을 갖는 건 강사뿐이다.
const sessions = new Set(); // { identifier, nickname, role, ws }

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

export function addSession(session) {
  sessions.add(session);
}

export function removeSession(session) {
  sessions.delete(session);
}

// 해당 식별자의 모든 연결.
export function getSessions(identifier) {
  return [...sessions].filter((s) => s.identifier === identifier);
}

export function isIdentifierTaken(identifier) {
  return getSessions(identifier).length > 0;
}

export function listStudents() {
  return [...sessions].filter((s) => s.role === "student");
}

function admins() {
  return [...sessions].filter((s) => s.role === "admin");
}

function send(session, payload) {
  if (session.ws && session.ws.readyState === session.ws.OPEN) {
    session.ws.send(JSON.stringify(payload));
  }
}

export function sendToIdentifier(identifier, payload) {
  for (const session of getSessions(identifier)) send(session, payload);
}

export function broadcastToAdmins(payload) {
  for (const admin of admins()) send(admin, payload);
}

export function broadcastToAll(payload) {
  for (const session of sessions) send(session, payload);
}

export function userListPayload() {
  return {
    type: "user_list",
    users: listStudents().map((s) => ({ nickname: s.nickname, identifier: s.identifier })),
  };
}

// 관리자가 지정한 공유 디렉토리 절대경로. 미지정 시 null.
export const shareState = { root: null };
