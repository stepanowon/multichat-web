import crypto from "node:crypto";

// docs/2-stack.md 7장: 패스워드는 환경변수로만 주입, 파일/DB 저장 없음.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD;

if (!ADMIN_PASSWORD || !STUDENT_PASSWORD) {
  console.error(
    "ADMIN_PASSWORD, STUDENT_PASSWORD 환경변수를 설정한 뒤 서버를 기동하세요."
  );
  process.exit(1);
}

export { ADMIN_PASSWORD, STUDENT_PASSWORD };

// JWT 서명 시크릿: 기동 시 1회 생성, 메모리에만 보관(재기동 시 기존 토큰 전부 무효화).
export const JWT_SECRET = crypto.randomBytes(32).toString("hex");

export const PORT = process.env.PORT || 3000;
