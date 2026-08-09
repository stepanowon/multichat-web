import { useRef, useState } from "react";
import { fileToBase64 } from "../useFileDrop.js";

export default function ChatInput({ onSendText, onSendImage, onSendFile, checkSize }) {
  const [text, setText] = useState("");
  const fileInputRef = useRef(null);

  function submit() {
    if (!text.trim()) return;
    onSendText(text.trim());
    setText("");
  }

  async function handleFilePick(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !checkSize(file)) return;
    const base64 = await fileToBase64(file);
    if (file.type.startsWith("image/")) onSendImage(base64);
    else onSendFile(base64, file.name);
  }

  return (
    <div className="chat-input">
      <button className="attach-btn" onClick={() => fileInputRef.current.click()} title="파일 첨부">＋</button>
      <input ref={fileInputRef} type="file" hidden onChange={handleFilePick} />
      <textarea
        className="text-input"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="메시지 입력 (Shift+Enter 줄바꿈 / 클립보드 이미지 붙여넣기 / 파일 드래그앤드롭 가능, 10MB 이내)"
      />
      <button className="send-btn" onClick={submit}>전송</button>
    </div>
  );
}
