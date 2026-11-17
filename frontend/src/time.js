// 날짜 구분 기준은 UTC가 아닌 KST(GMT+9) — 서버 server/src/time.js 와 같은 기준.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 오늘 날짜(KST) "YYYY-MM-DD".
export function todayKst() {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
