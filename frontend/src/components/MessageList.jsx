import { useEffect, useRef, useState } from "react";
import ContextMenu from "./ContextMenu.jsx";
import Lightbox from "./Lightbox.jsx";
import { copyText } from "../clipboard.js";

// ts는 서버가 UTC(ISO 8601)로 저장 — 문자열을 그대로 잘라 쓰면 GMT+0으로 보임.
// Date로 파싱해 브라우저 로케일 타임존으로 표시한다.
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function downloadUrl(url, fileName) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function MessageList({ messages, myIdentifier, onDelete }) {
  const [menu, setMenu] = useState(null); // { x, y, items }
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const bottomRef = useRef(null);

  // 메시지가 추가/삭제되거나 날짜를 바꿔 목록이 새로 로드될 때마다 가장 아래로.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function handleContextMenu(e, msg) {
    const isMine = msg.fromIdentifier === myIdentifier;
    const items = [];
    if (msg.msgType === "text") {
      items.push({ label: "복사하기", onClick: () => copyText(msg.text) });
    }
    if (msg.msgType === "image") {
      items.push({ label: "이미지 다운로드", onClick: () => downloadUrl(`/attachments/${msg.attachmentPath}`) });
    }
    if (isMine) {
      items.push({
        label: "삭제하기",
        danger: true,
        onClick: () => onDelete(msg.id, msg.ts.slice(0, 10)),
      });
    }
    if (items.length === 0) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  return (
    <div className="message-list">
      {messages.map((m) =>
        m.type === "system" ? (
          <div key={m.id || m.ts} className="system-message">
            {m.nickname}님이 {m.event === "join" ? "입장" : "퇴장"}했습니다 · {formatTime(m.ts)}
          </div>
        ) : (
          <div
            key={m.id}
            className={`bubble-row ${m.fromIdentifier === myIdentifier ? "mine" : ""}`}
          >
            <div className="bubble" onContextMenu={(e) => handleContextMenu(e, m)}>
              <div className="bubble-meta">
                {m.from} · {formatTime(m.ts)}
                {m.to !== "all" && m.fromIdentifier !== myIdentifier ? " (나에게)" : ""}
              </div>
              {m.msgType === "image" && (
                <img
                  className="bubble-image"
                  src={`/attachments/${m.attachmentPath}`}
                  alt="첨부 이미지"
                  onClick={() => setLightboxSrc(`/attachments/${m.attachmentPath}`)}
                />
              )}
              {m.msgType === "file" && (
                <a href={`/attachments/${m.attachmentPath}`} target="_blank" rel="noreferrer">
                  📎 {m.fileName}
                </a>
              )}
              {m.msgType === "text" && <div className="bubble-text">{m.text}</div>}
            </div>
          </div>
        )
      )}
      <div ref={bottomRef} />
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
