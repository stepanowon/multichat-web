import express from "express";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { PORT } from "./env.js";
import authRoutes from "./routes/auth.js";
import shareRoutes from "./routes/share.js";
import messageRoutes from "./routes/messages.js";
import serverInfoRoutes from "./routes/serverInfo.js";
import { attachWebSocketServer } from "./ws.js";

const app = express();
// 첨부파일은 WS로 오므로 REST 바디는 로그인/공유경로 같은 작은 JSON뿐 — 기본 한도(100kb)로 충분.
app.use(express.json());

app.use("/api", authRoutes);
app.use("/api", shareRoutes);
app.use("/api", messageRoutes);
app.use("/api", serverInfoRoutes);

// 메시지에 첨부된 이미지/파일 서빙. data/messages 전체가 아니라 images/ 하위만 노출 —
// 상위에 있는 날짜별 대화 로그(.jsonl)가 인증 없이 내려가지 않도록.
// ponytail: 인증 없는 공개 경로, 파일명에 랜덤 해시(32비트)만 붙음 — 접근 통제 필요해지면 인증 미들웨어 추가.
// 수강생이 올린 .html/.svg가 같은 출처에서 렌더링되지 않도록 항상 다운로드로 내려보내고
// MIME 스니핑도 막는다(<img> 표시는 Content-Disposition과 무관하게 그대로 동작).
app.use(
  "/attachments/images",
  express.static(path.join(import.meta.dirname, "../data/messages/images"), {
    setHeaders: (res, filePath) => {
      res.attachment(path.basename(filePath));
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

// React 빌드 산출물 서빙 (frontend build → server/static)
app.use(express.static(path.join(import.meta.dirname, "../static")));
app.get(/^(?!\/api|\/attachments|\/ws).*/, (req, res) => {
  res.sendFile(path.join(import.meta.dirname, "../static/index.html"));
});

// certs/ 에 key.pem, cert.pem 있으면 HTTPS로, 없으면 기존 HTTP로 기동.
const keyPath = path.join(import.meta.dirname, "../../certs/key.pem");
const certPath = path.join(import.meta.dirname, "../../certs/cert.pem");
const hasCert = fs.existsSync(keyPath) && fs.existsSync(certPath);

const server = hasCert
  ? https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app)
  : http.createServer(app);
attachWebSocketServer(server);

const protocol = hasCert ? "https" : "http";
server.listen(PORT, "0.0.0.0",() => {
  console.log(`MultiChat server listening on ${protocol}://localhost:${PORT}`);
});
