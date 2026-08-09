export function connectChatSocket(onMessage) {
  const token = sessionStorage.getItem("token");
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws?token=${token}`);
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  ws.onclose = (ev) => {
    // 토큰 무효(4401)면 조용히 끊기는 대신 재로그인 화면으로.
    if (ev.code === 4401) {
      sessionStorage.clear();
      location.reload();
    }
  };
  return ws;
}

// 접속 직후 몇백ms는 소켓이 아직 CONNECTING 상태라 ws.send()가 예외를 던진다 — 이벤트 핸들러
// 안에서 조용히 죽어버려 "아무 반응 없음"으로만 보이던 버그. 여기서 막고 알려준다.
function send(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert("서버와 연결이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.");
    return;
  }
  ws.send(JSON.stringify(payload));
}

export function sendText(ws, text, to = "all") {
  send(ws, { type: "message", msgType: "text", text, to });
}

export function sendImage(ws, base64, to = "all") {
  send(ws, { type: "message", msgType: "image", imageData: base64, to });
}

export function sendFile(ws, base64, fileName, to = "all") {
  send(ws, { type: "message", msgType: "file", fileData: base64, fileName, to });
}

export function deleteMessage(ws, id, date) {
  send(ws, { type: "delete", id, date });
}
