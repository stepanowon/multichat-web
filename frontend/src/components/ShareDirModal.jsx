import { useState } from "react";
import { api } from "../api.js";

export default function ShareDirModal({ currentRoot, onClose, onUpdated }) {
  const [dirPath, setDirPath] = useState(currentRoot || "");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      const data = await api.setShareDir(dirPath);
      onUpdated(data.path);
      onClose();
    } catch (e) {
      setError(e.data?.error === "INVALID_PATH" ? "존재하지 않는 디렉토리입니다." : "지정 실패");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>공유 디렉토리 지정</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <label>서버 경로</label>
        <input value={dirPath} onChange={(e) => setDirPath(e.target.value)} placeholder="/srv/course/day1" />
        {currentRoot && <p className="hint-text">현재 지정: {currentRoot}</p>}
        {error && <p className="error-text">{error}</p>}
        <button className="button" onClick={submit}>지정하기</button>
      </div>
    </div>
  );
}
