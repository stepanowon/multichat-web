# CLAUDE.md

## 언어

- **모든 대화(답변·질문·진행 상황 보고)는 한국어로 한다.**
- 코드 주석, 커밋 메시지, 문서도 기존 관례대로 한국어로 작성한다(식별자·에러 코드는 영어 유지).

## 프로젝트 개요

강의실 LAN에서 강사 1명과 수강생 여러 명이 메시지·파일·설문을 주고받는 단일 서버 웹앱.
DB 없이 파일시스템(`server/data/`)과 프로세스 메모리(세션)만 쓴다. 상세 스펙은 `docs/`(1-prd, 2-stack, 3-wireframe, 4-api, 5-user-scenario).

```
server/    Node(ESM) + Express 4 + ws 8 + jsonwebtoken — REST(/api), WebSocket(/ws), 첨부 서빙(/attachments/images)
frontend/  React 18 + Vite 5 — 빌드 산출물은 server/static 으로 출력(커밋 대상)
```

## 실행

```bash
# 개발: 백엔드(5000) + Vite dev server(5173, /api·/ws·/attachments 프록시)
cd server && ADMIN_PASSWORD=admin123 STUDENT_PASSWORD=student123 npm run dev
cd frontend && npm run dev

# 배포: 프론트 빌드 후 keep-alive로 서버 기동
cd server && ADMIN_PASSWORD=... STUDENT_PASSWORD=... npm start

# 프론트만 빌드(server/static 갱신)
cd frontend && npx vite build
```

- `ADMIN_PASSWORD`, `STUDENT_PASSWORD` 없으면 서버가 즉시 종료. `PORT` 기본 5000.
- 자동화된 테스트는 없다. 검증은 서버 사본을 임시 디렉토리에 띄워 스크립트(fetch/ws)나 Playwright로 한다 — 실제 `server/data`를 건드리지 말 것.

## 구조 메모

- `server/src/state.js`: 세션 Map(identifier → ws), 브로드캐스트 헬퍼. `ws.js`: 채팅/삭제/강퇴 처리.
- `messageStore.js`: 날짜별 `data/messages/<YYYY-MM-DD>.jsonl`, 첨부는 `data/messages/images/<date>/`.
- `surveyStore.js` + `routes/surveys.js`: 설문은 `data/surveys.json` 단일 파일, 변경 시 WS `survey_updated` 브로드캐스트.
- 프론트 `ws.js`: 5초 자동 재연결 래퍼. close 4401(토큰 무효)·4403(강퇴)이면 로그인 화면으로.
- 페이지는 `AdminChat.jsx` / `StudentChat.jsx` 두 개, 공용 로직은 훅(`useFileDrop`, `useSurveys`)으로 분리.

## 지켜야 할 규칙

- **클라이언트 입력은 신뢰하지 않는다.** WS 메시지는 핸들러 전체가 try/catch로 감싸져 있고 필드 타입을 검증한다 — 새 메시지 타입을 추가할 때도 같은 방식으로. 예외가 새면 프로세스가 죽고, 재기동 시 JWT 시크릿이 바뀌어 전원이 재로그인해야 한다.
- 경로에 들어가는 `date`는 `isValidDate`(YYYY-MM-DD)로 검증.
- `/attachments`는 `images/` 하위만 공개(대화 로그 .jsonl 노출 금지). 첨부 응답은 `Content-Disposition: attachment` + `nosniff`.
- 날짜 구분은 KST(+9h) 기준. 서버·프론트 양쪽에 같은 계산이 있으므로 함께 바꿀 것.
- 프론트에서 `crypto.randomUUID`, `navigator.clipboard` 등 보안 컨텍스트 전용 API에 의존하지 말 것 — 수강생은 `http://<LAN IP>`로 접속한다(`clipboard.js` 폴백 참고).
- 파일에 영속화할 때는 임시파일 → rename으로 원자적으로 쓴다(`surveyStore.save` 참고).
- API/WS 프로토콜을 바꾸면 `docs/4-api.md`, 사용자 기능을 바꾸면 `README.md`도 함께 갱신.
- 프론트를 수정했으면 `npx vite build`로 `server/static`도 갱신해 커밋에 포함한다(배포 시 그대로 서빙됨).
- 의도적으로 단순화한 부분은 `ponytail:` 주석으로 한계와 확장 시점을 남기는 관례가 있다.
