// npm start가 이 스크립트를 실행 — 서버 프로세스(src/index.js)가 죽으면(예외로 뻗거나
// OOM 등) 잠깐 쉬었다가 자동으로 재기동한다. forever/pm2 같은 별도 패키지 없이 Node
// child_process만으로 충분한 규모(단일 인스턴스, 강의용).
// ponytail: 재시작 횟수 제한/로그 파일 적재 같은 운영 기능은 없음 — 필요해지면 pm2로 교체.
import { spawn } from "node:child_process";
import path from "node:path";

const entry = path.join(import.meta.dirname, "../src/index.js");
const serverDir = path.join(import.meta.dirname, "..");
const RESTART_DELAY_MS = 1000;

let stopping = false;
let child = null;

function start() {
  child = spawn(process.execPath, ["--env-file-if-exists=.env", entry], {
    stdio: "inherit",
    cwd: serverDir,
  });

  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.error(
      `[keep-alive] 서버 종료(code=${code}, signal=${signal}) — ${RESTART_DELAY_MS}ms 후 재시작`,
    );
    setTimeout(start, RESTART_DELAY_MS);
  });
}

function forwardSignal(sig) {
  stopping = true;
  child?.kill(sig);
  process.exit(0);
}

process.once("SIGINT", () => forwardSignal("SIGINT"));
process.once("SIGTERM", () => forwardSignal("SIGTERM"));

start();
