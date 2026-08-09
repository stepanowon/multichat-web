import { Router } from "express";
import os from "node:os";
import { requireAuth, requireAdmin } from "../auth.js";
import { PORT } from "../env.js";

const router = Router();

function isPrivateLan(ip) {
  // 169.254.x.x(APIPA/link-local)는 실제 LAN에서 접속 불가 — 학생 안내용으로는 노이즈일 뿐 제외.
  return !ip.startsWith("169.254.");
}

function localIPv4Addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i.family === "IPv4" && !i.internal && isPrivateLan(i.address))
    .map((i) => i.address);
}

// 강사 화면에 "수강생 접속 주소"로 안내하기 위한 서버 LAN IP 목록.
// protocol은 req.protocol(현재 요청이 실제로 들어온 http/https)을 그대로 사용 —
// 서버는 인증서 유무에 따라 둘 중 하나로만 떠 있으므로 이 요청의 프로토콜이 곧 서버의 프로토콜.
router.get("/server-info", requireAuth, requireAdmin, (req, res) => {
  res.json({ port: PORT, addresses: localIPv4Addresses(), protocol: req.protocol });
});

export default router;
