import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { verifyToken } from "./auth.js";
import {
  addSession,
  removeSession,
  isIdentifierTaken,
  broadcastToAdmins,
  broadcastToAll,
  sendToIdentifier,
  userListPayload,
} from "./state.js";
import { appendMessage, saveAttachment, deleteMessage } from "./messageStore.js";

function todayDate(ts) {
  return ts.slice(0, 10);
}

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB, 클라이언트 제한과 동일(defense in depth)

// base64 문자열 디코딩 후 실제 바이트 크기(패딩 보정).
function base64ByteLength(base64) {
  const len = base64.length;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (len * 3) / 4 - padding;
}

export function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
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
    }

    ws.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (data.type === "message") handleChatMessage(session, data);
      else if (data.type === "delete") handleDeleteMessage(session, data);
    });

    ws.on("close", () => {
      removeSession(session.identifier);
      if (session.role === "student") {
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
  appendMessage(todayDate(ts), entry);
  broadcastToAdmins(entry);
}

// 본인 메시지만 삭제 가능. 누가 어디까지 봤는지 서버가 다 알지 못하므로(1:1 포함)
// 삭제 알림은 전원에게 브로드캐스트 — 화면에 그 메시지가 없는 클라이언트는 그냥 무시한다.
function handleDeleteMessage(session, data) {
  const { id, date } = data;
  if (!id || !date) return;
  if (deleteMessage(date, id, session.identifier)) {
    broadcastToAll({ type: "deleted", id });
  }
}

function checkAttachmentSize(session, base64Data) {
  if (base64ByteLength(base64Data) <= MAX_ATTACHMENT_SIZE) return true;
  sendToIdentifier(session.identifier, { type: "error", code: "FILE_TOO_LARGE", message: "파일은 10MB 이하만 전송할 수 있습니다." });
  return false;
}

function handleChatMessage(session, data) {
  const ts = new Date().toISOString();
  const date = todayDate(ts);
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
  };

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

  const payload = { type: "message", ...message };
  if (to === "all") {
    broadcastToAll(payload);
  } else if (to === "admin") {
    broadcastToAdmins(payload);
    sendToIdentifier(session.identifier, payload); // 발신자(학생) 본인 화면에도 표시
  } else {
    sendToIdentifier(to, payload);
    sendToIdentifier(session.identifier, payload); // 발신자(관리자) 본인 화면에도 표시
  }
}
