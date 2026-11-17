import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { sanitizeFileName } from "./sanitize.js";

// docs/2-stack.md 5장 레이아웃: data/messages/<date>.jsonl, data/messages/images/<date>/<uuid>.ext
const messagesDir = path.join(import.meta.dirname, "../data/messages");
const imagesDir = path.join(messagesDir, "images");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// 클라이언트가 넘긴 date가 그대로 경로에 들어가므로 "YYYY-MM-DD"만 허용(경로 탈출 차단).
export function isValidDate(date) {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function dateFile(date) {
  if (!isValidDate(date)) throw new Error("INVALID_DATE");
  return path.join(messagesDir, `${date}.jsonl`);
}

export function appendMessage(date, message) {
  ensureDir(messagesDir);
  fs.appendFileSync(dateFile(date), JSON.stringify(message) + "\n", "utf8");
}

export function listDates() {
  if (!fs.existsSync(messagesDir)) return [];
  return fs
    .readdirSync(messagesDir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.slice(0, -".jsonl".length))
    .sort();
}

export function readMessages(date) {
  const file = dateFile(date);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// base64 데이터를 이미지/첨부파일로 저장, 로그에 남길 상대경로 반환.
// 저장 파일명은 "원본이름.해시.확장자" 형태 — 다운로드해도 어떤 파일인지 알아볼 수 있으면서
// 동시에 이름 충돌은 나지 않는다(uuid 통짜 이름 대신).
export function saveAttachment(date, base64Data, fileName) {
  const dir = path.join(imagesDir, date);
  ensureDir(dir);
  const original = path.basename(fileName || "file");
  const ext = path.extname(original);
  const base = sanitizeFileName(original.slice(0, original.length - ext.length));
  const hash = crypto.randomBytes(4).toString("hex");
  const savedName = `${base}.${hash}${ext}`;
  fs.writeFileSync(path.join(dir, savedName), Buffer.from(base64Data, "base64"));
  return `images/${date}/${savedName}`;
}

export function attachmentAbsolutePath(relativePath) {
  return path.join(messagesDir, relativePath);
}

// 본인 메시지만 삭제 가능(관리자는 전체 삭제 가능) — 로그 파일에서도 제거
// (append-only라 통째로 다시 씀, 규모상 문제없음).
export function deleteMessage(date, id, requesterIdentifier, isAdmin = false) {
  const messages = readMessages(date);
  const idx = messages.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  if (!isAdmin && messages[idx].fromIdentifier !== requesterIdentifier) return false;

  const [deleted] = messages.splice(idx, 1);
  if (deleted.attachmentPath) {
    try { fs.unlinkSync(attachmentAbsolutePath(deleted.attachmentPath)); } catch { /* 이미 없으면 무시 */ }
  }
  const body = messages.map((m) => JSON.stringify(m)).join("\n");
  fs.writeFileSync(dateFile(date), body ? body + "\n" : "", "utf8");
  return true;
}

// 학생 조회용 필터: 시스템 메시지 제외, 본인 무관 1:1 메시지 제외.
export function filterForStudent(messages, identifier) {
  return messages.filter((m) => {
    if (m.type === "system") return false;
    if (m.to === "all") return true;
    return m.to === identifier || m.fromIdentifier === identifier;
  });
}

export function toMarkdown(date, messages) {
  const lines = [`# ${date} 대화 기록`, ""];
  for (const m of messages) {
    if (m.type === "system") continue;
    // ts는 UTC 저장값 — 내보내기 파일엔 서버가 돌아가는 지역(=강의실) 로컬 시간으로 표기.
    const time = new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const targetLabel = m.to === "admin" ? "강사" : m.toNickname || m.to;
    const target = m.to && m.to !== "all" ? ` → ${targetLabel}` : "";
    lines.push(`### ${time} ${m.from}${target}`);
    if (m.msgType === "image") {
      lines.push(`![image](${m.attachmentPath})`);
    } else if (m.msgType === "file") {
      lines.push(`[${m.fileName}](${m.attachmentPath})`);
    } else {
      lines.push(m.text || "");
    }
    lines.push("");
  }
  return lines.join("\n");
}
