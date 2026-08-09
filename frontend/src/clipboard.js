// navigator.clipboard(비동기 Clipboard API)는 "보안 컨텍스트"(https 또는 localhost)에서만 존재한다.
// 수강생들은 강사가 안내한 LAN IP로 http://192.168.x.x:5000 처럼 접속하는데, 이건 보안 컨텍스트가
// 아니라서 navigator.clipboard 자체가 undefined — 그대로 호출하면 조용히 예외만 던지고 아무 반응이 없다.
// 옛날 방식(execCommand)은 보안 컨텍스트 여부와 상관없이 동작해서 폴백으로 쓴다.
export function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  }
  return legacyCopy(text) ? Promise.resolve() : Promise.reject(new Error("copy failed"));
}

function legacyCopy(text) {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  el.remove();
  return ok;
}
