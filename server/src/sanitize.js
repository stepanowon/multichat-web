// 파일명으로 쓸 때 파일시스템/다운로드에서 문제되는 문자(경로 구분자, 예약 문자, 제어문자)만 "_"로 바꾼다.
// 비면 fallback.
export function sanitizeFileName(name, fallback = "file") {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || fallback;
}
