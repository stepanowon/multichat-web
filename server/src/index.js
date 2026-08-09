import express from "express";
import http from "node:http";
import path from "node:path";
import { PORT } from "./env.js";
import authRoutes from "./routes/auth.js";
import shareRoutes from "./routes/share.js";
import messageRoutes from "./routes/messages.js";
import serverInfoRoutes from "./routes/serverInfo.js";
import { attachWebSocketServer } from "./ws.js";

const app = express();
app.use(express.json({ limit: "15mb" })); // 클립보드 이미지/드래그앤드롭 파일 base64 전송 고려

app.use("/api", authRoutes);
app.use("/api", shareRoutes);
app.use("/api", messageRoutes);
app.use("/api", serverInfoRoutes);

// 메시지에 첨부된 이미지/파일 다운로드용 정적 서빙(ponytail: 인증 없는 공개 경로,
// uuid 파일명이라 추측 곤란 — 접근 통제 필요해지면 인증 미들웨어 추가).
app.use("/attachments", express.static(path.join(import.meta.dirname, "../data/messages")));

// React 빌드 산출물 서빙 (frontend build → server/static)
app.use(express.static(path.join(import.meta.dirname, "../static")));
app.get(/^(?!\/api|\/attachments|\/ws).*/, (req, res) => {
  res.sendFile(path.join(import.meta.dirname, "../static/index.html"));
});

const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`MultiChat server listening on http://localhost:${PORT}`);
});
