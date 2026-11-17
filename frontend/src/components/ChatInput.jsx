import { useRef, useState } from "react";

// 텍스트 입력 + 파일 첨부(＋) 버튼. 선택한 파일은 onPickFile로 넘겨 드롭·붙여넣기와 같은 경로
// (useFileDrop의 deliver: 크기 확인 → base64 → 이미지/파일 구분)로 처리한다.
export default function ChatInput({ onSendText, onPickFile }) {
  const [text, setText] = useState("");
  const fileInputRef = useRef(null);

  function submit() {
    if (!text.trim()) return;
    onSendText(text.trim());
    setText("");
  }

  function handleFilePick(e) {
    const file = e.target.files[0];
    e.target.value = ""; // 같은 파일을 연달아 골라도 onChange가 다시 발생하도록
    onPickFile(file);
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
