import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 브라우저가 요청 도중 탭을 닫거나 새로고침하면 프록시 소켓이 ECONNABORTED/ECONNRESET으로
// 끊기는데, 'error' 리스너가 없으면 Node가 이걸 uncaught exception으로 던져 dev 서버가 죽는다.
// 흔한 상황(사용자가 페이지 이동)이라 그냥 무시하고 넘어가면 된다.
function silenceProxyErrors(proxy) {
  proxy.on("error", () => {});
}

// 빌드 산출물은 server/static으로 배포(docs/2-stack.md 3장), dev 서버는 백엔드로 프록시.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../server/static",
    emptyOutDir: true,
  },
  server: {
    host: true, // LAN에서 접속 가능하도록 0.0.0.0 바인딩 (기본은 localhost만 허용)
    proxy: {
      "/api": { target: "http://localhost:5000", configure: silenceProxyErrors },
      "/attachments": { target: "http://localhost:5000", configure: silenceProxyErrors },
      "/ws": { target: "ws://localhost:5000", ws: true, configure: silenceProxyErrors },
    },
  },
});
