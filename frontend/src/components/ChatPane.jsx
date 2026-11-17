import MessageList from "./MessageList.jsx";
import ChatInput from "./ChatInput.jsx";
import { useFileDrop } from "../useFileDrop.js";

// 채팅 본문 영역: 메시지 목록 + 입력창. 영역 전체가 파일 드롭 대상이고,
// 클립보드 붙여넣기·＋ 버튼 첨부도 같은 경로(useFileDrop)로 현재 받는 사람(target)에게 보낸다.
export default function ChatPane({ chat, target }) {
  const { dragOver, sizeError, deliver, dropHandlers } = useFileDrop({
    onImage: (base64) => chat.sendImage(base64, target),
    onFile: (base64, fileName) => chat.sendFile(base64, fileName, target),
  });

  return (
    <div className={`main-pane ${dragOver ? "drag-over" : ""}`} {...dropHandlers}>
      <MessageList messages={chat.messages} onDelete={chat.deleteMessage} />
      {sizeError && <p className="error-text drop-error">{sizeError}</p>}
      <ChatInput onSendText={(text) => chat.sendText(text, target)} onPickFile={deliver} />
    </div>
  );
}
