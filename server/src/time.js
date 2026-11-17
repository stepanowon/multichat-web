// 날짜 구분·표기는 서버가 어느 타임존에서 돌든 KST(GMT+9) 기준으로 통일한다.
// (프론트 frontend/src/time.js 에도 같은 기준이 있다 — 바꿀 때 함께 바꿀 것)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKstIso(ts) {
  return new Date(new Date(ts).getTime() + KST_OFFSET_MS).toISOString();
}

// "YYYY-MM-DD" — 날짜별 대화 로그 파일 구분 기준.
export function kstDate(ts = Date.now()) {
  return toKstIso(ts).slice(0, 10);
}

// "YYYY-MM-DD HH:MM" — 내보내기 등 사람이 읽는 표기.
export function formatKst(ts) {
  return toKstIso(ts).slice(0, 16).replace("T", " ");
}
