import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { verifyToken } from "./auth.js";
import {
  addSession,
  removeSession,
  getSessions,
  isIdentifierTaken,
  broadcastToAdmins,
  broadcastToAll,
  sendToIdentifier,
  userListPayload,
  bumpSessionVersion,
} from "./state.js";
import { appendMessage, saveAttachment, deleteMessage, isValidDate } from "./messageStore.js";
import { kstDate } from "./time.js";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB, 클라이언트 제한과 동일(defense in depth)

// base64 문자열 디코딩 후 실제 바이트 크기(패딩 보정).
function base64ByteLength(base64) {
  const len = base64.length;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (len * 3) / 4 - padding;
}

// 10MB 원본 → base64 약 13.4MB + JSON 껍데기. 이보다 큰 프레임은 ws가 받기 전에 끊는다
// (기본값 100MB까지 메모리에 다 받은 뒤 크기 검사하는 것을 방지).
const MAX_WS_PAYLOAD = 15 * 1024 * 1024;

const isString = (v) => typeof v === "string";

export function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: MAX_WS_PAYLOAD });

  wss.on("connection", (ws, req) => {
    // 소켓 단위 에러(maxPayload 초과, 비정상 프레임 등)는 리스너가 없으면 uncaught로 프로세스가 죽는다.
    // ws가 알아서 연결을 닫으므로(→ "close" 핸들러로 정리) 여기선 기록만 한다.
    ws.on("error", (err) => console.error("[ws] socket error:", err.message));

    const token = new URL(req.url, "http://localhost").searchParams.get("token");
    let user;
    try {
      user = verifyToken(token);
    } catch {
      ws.close(4401, "invalid token");
      return;
    }

    // 학생 고유식별자 충돌은 로그인 시점(1차)에 이어 접속(WS) 시점에도 최종 확인.
    if (user.role === "student" && isIdentifierTaken(user.identifier)) {
      ws.close(4409, "identifier taken");
      return;
    }

    const session = { identifier: user.identifier, nickname: user.nickname, role: user.role, ws };
    addSession(session);

    ws.send(JSON.stringify({ type: "welcome", role: user.role, nickname: user.nickname }));

    if (user.role === "student") {
      broadcastSystem({ event: "join", nickname: user.nickname, identifier: user.identifier });
      broadcastToAdmins(userListPayload());
    } else {
      // 관리자가 접속한 시점에 이미 접속 중인 학생 목록을 바로 보내준다(학생 입퇴장 이벤트를 기다리지 않도록).
      ws.send(JSON.stringify(userListPayload()));
    }

    ws.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      // 핸들러 예외가 여기서 새면 프로세스 전체가 죽고(재기동 시 JWT 시크릿 교체로 전원 재로그인)
      // 수강생 한 명이 강의 전체를 끊을 수 있다 — 한 메시지 실패로 국한시킨다.
      try {
        if (Object.hasOwn(handlers, data.type)) handlers[data.type](session, data);
      } catch (err) {
        console.error(`[ws] ${session.identifier} 메시지 처리 실패:`, err);
      }
    });

    ws.on("close", () => {
      // 이 연결만 지운다(같은 식별자의 다른 연결은 유지). 같은 사람의 연결이 아직 남아 있으면
      // 실제로 나간 게 아니므로 퇴장 알림은 보내지 않는다.
      removeSession(session);
      if (session.role === "student" && !isIdentifierTaken(session.identifier)) {
        broadcastSystem({ event: "leave", nickname: session.nickname, identifier: session.identifier });
        broadcastToAdmins(userListPayload());
      }
    });
  });

  return wss;
}

// 강사 화면에만 표시되는 입퇴장 알림(PRD 6항) — 날짜별 로그에도 남겨 대화 내보내기에 포함.
function broadcastSystem({ event, nickname, identifier }) {
  const ts = new Date().toISOString();
  const entry = { type: "system", event, nickname, identifier, ts };
  appendMessage(kstDate(ts), entry);
  broadcastToAdmins(entry);
}

// 본인 메시지만 삭제 가능(관리자는 전체 삭제 가능). 누가 어디까지 봤는지 서버가 다 알지
// 못하므로(1:1 포함) 삭제 알림은 전원에게 브로드캐스트 — 화면에 그 메시지가 없는 클라이언트는
// 그냥 무시한다.
function handleDeleteMessage(session, data) {
  const { id, date } = data;
  if (!isString(id) || !isValidDate(date)) return;
  if (deleteMessage(date, id, session.identifier, session.role === "admin")) {
    broadcastToAll({ type: "deleted", id });
  }
}

// 강사가 특정 수강생 연결을 강제 종료. ws.close()가 곧 "close" 이벤트를 발생시켜
// removeSession + 퇴장 브로드캐스트는 기존 흐름을 그대로 탄다.
function handleKick(session, data) {
  if (session.role !== "admin" || !isString(data.identifier)) return;
  const targets = getSessions(data.identifier).filter((s) => s.role === "student");
  if (targets.length === 0) return;
  bumpSessionVersion(data.identifier); // 기존 JWT를 즉시 무효화(docs/4-api.md 0항)
  for (const target of targets) target.ws.close(4403, "kicked by admin");
}

function checkAttachmentSize(session, base64Data) {
  if (base64ByteLength(base64Data) <= MAX_ATTACHMENT_SIZE) return true;
  sendToIdentifier(session.identifier, { type: "error", code: "FILE_TOO_LARGE", message: "파일은 10MB 이하만 전송할 수 있습니다." });
  return false;
}

function handleChatMessage(session, data) {
  // 클라이언트 입력은 신뢰하지 않는다: 문자열이 아닌 값이 저장·브로드캐스트되면 서버(path/base64
  // 처리)가 죽거나, 받은 모든 클라이언트의 React 렌더링이 깨지고 로그에 남아 새로고침해도 재발한다.
  for (const key of ["text", "imageData", "fileData", "fileName", "to"]) {
    if (data[key] !== undefined && data[key] !== null && !isString(data[key])) return;
  }

  const ts = new Date().toISOString();
  const date = kstDate(ts);
  // 학생은 "전체"(모두에게) 또는 "강사"(강사에게만) 중 선택, 특정 학생 지정은 불가.
  const to = session.role === "student" ? (data.to === "all" ? "all" : "admin") : data.to || "all";

  const message = {
    id: crypto.randomUUID(),
    msgType: data.msgType === "image" || data.msgType === "file" ? data.msgType : "text",
    from: session.nickname,
    fromIdentifier: session.identifier,
    role: session.role,
    to,
    ts,
    date,
  };
  // 강사가 특정 수강생에게 보낸 1:1이면 받는 사람 닉네임도 남긴다(대화 내보내기에 "강사 → 홍길동"으로 표기).
  if (to !== "all" && to !== "admin") message.toNickname = getSessions(to)[0]?.nickname;

  if (message.msgType === "image" && data.imageData) {
    if (!checkAttachmentSize(session, data.imageData)) return;
    message.attachmentPath = saveAttachment(date, data.imageData, "image.png");
  } else if (message.msgType === "file" && data.fileData) {
    if (!checkAttachmentSize(session, data.fileData)) return;
    message.attachmentPath = saveAttachment(date, data.fileData, data.fileName || "file");
    message.fileName = data.fileName || "file";
  } else {
    message.text = data.text || "";
  }

  appendMessage(date, message);
  deliver(session, { type: "message", ...message });
}

// 수신 대상에 따라 전송. 1:1(강사에게/특정 학생에게)이면 발신자 본인 화면에도 보낸다.
function deliver(sender, payload) {
  if (payload.to === "all") return broadcastToAll(payload);
  if (payload.to === "admin") broadcastToAdmins(payload);
  else sendToIdentifier(payload.to, payload);
  sendToIdentifier(sender.identifier, payload);
}

// 클라이언트 → 서버 메시지 타입별 핸들러(docs/4-api.md 2.3).
const handlers = {
  message: handleChatMessage,
  delete: handleDeleteMessage,
  kick: handleKick,
};
