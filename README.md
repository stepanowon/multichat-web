# MultiChat Web

강사와 수강생이 실시간으로 메시지·파일·소스코드를 주고받는 웹 기반 강의용 메시징 시스템.

문서: [docs/1-prd.md](docs/1-prd.md) · [docs/2-stack.md](docs/2-stack.md) · [docs/3-wireframe.md](docs/3-wireframe.md) · [docs/4-api.md](docs/4-api.md) · [docs/5-user-scenario.md](docs/5-user-scenario.md)

## 구조

```
server/    Node.js + Express + ws 백엔드 (REST API, WebSocket, 파일/메시지 영속화)
frontend/  React + Vite 프론트엔드 (빌드 시 server/static 으로 배포)
```

## 필요 환경변수

| 변수 | 설명 |
|---|---|
| `ADMIN_PASSWORD` | 관리자(강사) 로그인 패스워드 |
| `STUDENT_PASSWORD` | 수강생 공통 로그인 패스워드 |
| `PORT` | 서버 포트 (기본 5000) |

패스워드는 파일/DB에 저장하지 않고 서버 기동 시 환경변수로만 주입한다.

## 개발 모드

```bash
# 터미널 1 — 백엔드 (localhost:5000)
cd server
npm install
ADMIN_PASSWORD=admin123 STUDENT_PASSWORD=student123 npm run dev

# 터미널 2 — 프론트엔드 (localhost:5173, /api·/ws는 5000으로 프록시)
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속.

(터미널 1의 `npm run dev`도 `predev`로 프론트 빌드를 한 번 수행하지만, 이 개발 모드에선 터미널 2의 Vite dev server를 보는 것이므로 그 빌드 산출물은 안 쓰임 — 무시해도 됨.)

## 배포(단일 서버로 실행)

```bash
cd frontend && npm install   # 최초 1회
cd ../server && npm install  # 최초 1회

ADMIN_PASSWORD=admin123 STUDENT_PASSWORD=student123 npm start
```

`npm start`(및 `npm run dev`)는 실행 전에 `frontend`를 자동으로 `npm run build`해 `server/static`에 반영한 뒤 서버를 띄운다(`prestart`/`predev` 훅). 브라우저에서 http://localhost:5000 접속.

`npm start`는 서버 프로세스가 죽으면 자동으로 재시작한다(`server/scripts/keep-alive.js`). 클라이언트도 연결이 끊기면 5초 후 자동 재연결을 시도하므로, 서버가 잠깐 재시작되는 동안에도 새로고침 없이 복구된다.

## 데이터 저장 위치

`server/data/` 아래에 날짜별 대화 로그(`.jsonl`)와 첨부 이미지/파일이 쌓인다(gitignore 대상, 재기동해도 유지). 강사가 지정하는 공유 디렉토리는 서버 파일시스템의 임의 경로를 가리키며 저장소에 포함되지 않는다.
