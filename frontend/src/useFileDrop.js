import { useEffect, useRef, useState } from "react";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 드래그앤드롭·클립보드 붙여넣기를 채팅 화면 전체(main-pane)에서 받기 위한 공용 훅.
// - 드롭: 입력창 같은 좁은 영역에만 걸면 대부분의 드롭이 빗나가 브라우저 기본 동작(파일 새 탭 열림)으로 샌다.
// - 붙여넣기: 캡처 후 브라우저로 돌아오면 포커스가 작은 텍스트 입력칸이 아니라 body에 있는 경우가 많아
//   input에만 paste 리스너를 달면 안 잡힌다 — document 레벨로 듣는다.
export function useFileDrop({ onImage, onFile, enabled = true }) {
  const [dragOver, setDragOver] = useState(false);
  const [sizeError, setSizeError] = useState("");

  // paste는 마운트 시 한 번만 구독하므로, 매 렌더 최신 콜백을 ref로 들고 있어야
  // target 라디오 변경 같은 상태 변화가 콜백 클로저에 반영된다.
  const onImageRef = useRef(onImage);
  const onFileRef = useRef(onFile);
  onImageRef.current = onImage;
  onFileRef.current = onFile;

  function checkSize(file) {
    if (file.size > MAX_FILE_SIZE) {
      setSizeError(`파일이 너무 큽니다 (최대 10MB, ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return false;
    }
    setSizeError("");
    return true;
  }

  async function deliver(file) {
    if (!file || !checkSize(file)) return;
    try {
      const base64 = await fileToBase64(file);
      if (file.type.startsWith("image/")) onImageRef.current(base64);
      else onFileRef.current(base64, file.name);
    } catch (err) {
      console.error("파일 처리 실패:", err);
      setSizeError("파일을 읽는 중 오류가 발생했습니다.");
    }
  }

  useEffect(() => {
    if (!enabled) return;
    function onPaste(e) {
      // 텍스트 입력 중 일반 문자 붙여넣기는 그대로 두고, 이미지/파일이 있을 때만 가로챈다.
      const item = [...(e.clipboardData?.items || [])].find((i) => i.kind === "file");
      if (!item) return;
      e.preventDefault();
      deliver(item.getAsFile());
    }
    // main-pane 밖(사이드바 등)에 떨어뜨리면 브라우저가 파일을 새 탭으로 열어버려 앱을 이탈하게 됨 — 창 전체에서 막는다.
    function preventNavigation(e) { e.preventDefault(); }

    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", preventNavigation);
    window.addEventListener("drop", preventNavigation);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", preventNavigation);
      window.removeEventListener("drop", preventNavigation);
    };
  }, [enabled]);

  const dropHandlers = {
    onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: (e) => { if (e.currentTarget === e.target) setDragOver(false); },
    onDrop: (e) => {
      e.preventDefault();
      setDragOver(false);
      deliver(e.dataTransfer.files?.[0]);
    },
  };

  return { dragOver, sizeError, checkSize, dropHandlers };
}
