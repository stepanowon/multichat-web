const RECONNECT_DELAY_MS = 5000;

// 서버 재기동(예: 크래시 후 자동 재시작)이나 네트워크 순단으로 연결이 끊겨도
// 화면을 새로고침하지 않고 5초 뒤 자동으로 재연결한다. 반환값은 실제 WebSocket이 아니라
// readyState/send/close만 위임하는 얇은 래퍼 — 재연결해도 호출부(ws.js 사용처)는 같은
// 객체를 계속 들고 있으면 된다.
export function connectChatSocket(onMessage) {
  let ws = null;
  let manualClose = false;

  function open() {
    const token = sessionStorage.getItem("token");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/ws?token=${token}`);
    ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
    ws.onclose = (ev) => {
      // 토큰 무효(4401)면 재연결해봐야 또 거부당하니 재로그인 화면으로.
      if (ev.code === 4401) {
        sessionStorage.clear();
        location.reload();
        return;
      }
      if (manualClose) return;
      setTimeout(open, RECONNECT_DELAY_MS);
    };
  }
  open();

  return {
    get readyState() {
      return ws ? ws.readyState : WebSocket.CONNECTING;
    },
    send: (data) => ws?.send(data),
    close: () => {
      manualClose = true;
      ws?.close();
    },
  };
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
