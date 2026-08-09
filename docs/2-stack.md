# MultiChat Web 기술 스택 설계

**버전:** 1.0
**작성일:** 2026-08-09
**관련 문서:** [1-prd.md](./1-prd.md)

---

## 1. 설계 원칙

- 동시 접속 30명 규모 → DB 서버, 별도 인증 서버 등 불필요. 파일시스템 + 단일 프로세스로 충분.
- 사용자 정보 비영속 요구 → DB 대신 메모리(Map)로 세션 관리.
- 메시지/이미지는 요구사항상 반드시 파일로 영속화 → 파일시스템에 직접 저장(날짜별 디렉토리), 별도 DB 불필요.
- 프론트는 React(요건상 지정) + `template/index.html` 스타일(다크 그라데이션/화이트 카드 톤)을 CSS로 계승.
- 인증은 JWT(요건상 지정): 로그인 성공 시 서버가 서명한 JWT 발급, REST/WebSocket 모두 이 토큰으로 검증.

## 2. 전체 구조

```
[Browser] <--WebSocket(실시간 메시지)--> [Node.js/Express 서버] <--fs--> [디스크: 대화로그/이미지/공유파일]
[Browser] <--HTTP(REST)--------------> [Node.js/Express 서버]
```

단일 Node.js 프로세스가 HTTP(정적 파일·REST API·파일 다운로드)와 WebSocket(실시간 메시징)을 모두 처리.

## 3. 백엔드

| 항목 | 선택 | 이유 |
|---|---|---|
| 런타임 | Node.js (LTS) | 프론트와 언어 통일, 파일 I/O·WebSocket 생태계 성숙 |
| 웹 프레임워크 | Express | REST(로그인, 파일목록/다운로드, Markdown 내보내기) 라우팅에 충분, 가벼움 |
| 실시간 통신 | `ws` (WebSocket) | 순수 텍스트/브로드캐스트만 필요, Socket.IO의 룸·재연결·폴백 기능 불필요 |
| 세션/사용자 목록 | 메모리 Map (`identifier -> {nickname, ws, role}`) | 비영속 요구, 프로세스 재시작 시 초기화되는 게 오히려 요구사항에 부합 |
| 관리자/공통 패스워드 | 환경변수 `ADMIN_PASSWORD`, `STUDENT_PASSWORD`로 주입, 기동 시 `process.env`에서 로드 | 파일/DB 저장·해싱·초기설정 화면 자체가 불필요해짐(입력값을 `crypto.timingSafeEqual`로 직접 비교) |
| `.env` 로드 | Node 내장 `--env-file-if-exists=.env`(`package.json` start/dev 스크립트에 지정) | `dotenv` 패키지 불필요, 파일 없어도 에러 없이 기동 |
| 프론트 빌드 자동화 | `server/package.json`의 `prestart`/`predev`가 `cd ../frontend && npm run build` 실행 | `npm start`/`npm run dev` 한 번으로 최신 프론트 산출물이 `server/static`에 반영됨, 빌드 깜빡하고 배포하는 실수 방지 |
| 정적 파일 서빙 | Express `static` (React 빌드 결과물, `frontend`가 `server/static`으로 직접 빌드) | 별도 프론트 서버 불필요, 빌드 산출물만 서빙 |
| JWT | `jsonwebtoken` (npm) | 서명/검증 표준 구현, 직접 구현할 이유 없음 |
| 강사용 접속 주소 안내 | `GET /api/server-info`(관리자 전용) — Node 내장 `os.networkInterfaces()`로 LAN IPv4 조회, link-local(169.254.x.x) 제외 | 수강생에게 알려줄 접속 주소를 강사가 직접 `ipconfig` 안 쳐도 화면에서 바로 확인 |

## 4. 프론트엔드

| 항목 | 선택 | 이유 |
|---|---|---|
| 구조 | React + Vite | 요건상 React 지정. 화면 수 적어 라우팅 없이 로그인 상태로 컴포넌트만 분기 |
| 상태 관리 | React 기본 state/context | 화면·데이터 규모상 Redux 등 불필요 |
| 실시간 수신 | 브라우저 내장 `WebSocket` API | 라이브러리 불필요 |
| 클립보드 이미지 붙여넣기 | `window`에 `paste` 리스너(문서 전체) + `ClipboardEvent.clipboardData.items` | 좁은 입력창에만 걸면 캡처 후 포커스가 body에 가 있어 안 잡히는 경우가 많아 문서 전체로 확대 |
| 파일 드래그앤드롭 | 채팅 영역(`main-pane`) 전체에 `onDrop`, `window`에는 `dragover`/`drop` 기본동작만 차단 | 입력창처럼 좁은 영역만 드롭 대상이면 대부분 빗나가 브라우저가 파일을 새 탭으로 열어버림 |
| 여러 줄 입력 | `<textarea>` + Enter=전송/Shift+Enter=줄바꿈 | 네이티브 요소, 라이브러리 불필요 |
| 메시지 복사/삭제/이미지 다운로드 컨텍스트 메뉴 | `contextmenu` 이벤트 가로채서 커스텀 메뉴(항목 배열) 표시 | 표준 API, 항목만 늘리면 되는 구조 |
| 클립보드 쓰기 | `navigator.clipboard.writeText` + `document.execCommand("copy")` 폴백 | `navigator.clipboard`는 보안 컨텍스트(https/localhost)에서만 존재 — 학생들이 접속하는 LAN IP+HTTP는 비보안 컨텍스트라 폴백 필수 |
| 이미지 확대보기 | 클릭 시 상태로 제어하는 전체화면 오버레이(CSS `position:fixed`) | 별도 라이트박스 라이브러리 불필요 |
| 날짜 선택 드롭다운 | `<select>` 네이티브 요소 | 커스텀 드롭다운 라이브러리 불필요 |
| JWT 저장 | `sessionStorage` | 탭 종료 시 자동 만료(요건상 사용자 정보 비영속과 맥락 일치), 별도 라이브러리 불필요 |
| WS 전송 가드 | `ws.readyState === WebSocket.OPEN` 확인 후 send, 아니면 안내 | 접속 직후 CONNECTING 상태에서 바로 보내면 예외가 이벤트 핸들러 안에서 조용히 죽어 "반응 없음"으로 보임 |
| 개발 서버 LAN 노출 | `vite.config.js`의 `server.host: true` | 기본은 localhost만 바인딩 — 원격 학생이 개발 서버로 접속하려면 필요 |
| 개발 프록시 안정성 | 프록시별 `configure(proxy)`에서 `proxy.on("error", ...)` 등록 | 탭 종료/새로고침으로 요청이 중간에 끊기면 `ECONNABORTED`가 uncaught exception으로 던져져 dev 서버 자체가 죽는 문제 방지 |
| 메시지 시간 표시 | 저장은 UTC ISO 문자열 그대로, 화면 표시만 `new Date(ts).toLocaleTimeString()`로 변환 | 문자열을 그대로 잘라 쓰면 GMT+0으로 보임 — 브라우저 로케일 타임존으로 변환해야 실제 시간과 맞음. Markdown 내보내기(서버 측)도 동일하게 `toLocaleTimeString()`으로 서버 로컬 시간대 표기 |

## 5. 데이터 저장 (파일시스템 레이아웃)

```
data/
  messages/
    2026-08-09.jsonl        # 그 날짜의 모든 메시지(1줄 1메시지, JSON)
    images/
      2026-08-09/
        test.a1b2c3d4.js      # "원본이름.해시8자리.확장자" — 붙여넣기 이미지/드래그앤드롭 파일 원본
  shared/                     # 관리자가 지정한 공유 디렉토리 (심볼릭 경로 아님, 실제 지정 경로를 서빙)
```

- 메시지 로그: 날짜별 `.jsonl`(append-only) → 동시쓰기 단순, DB 없이 날짜별 대화 조회/필터 용이.
- 메시지 삭제: 본인 것인지 확인 후 해당 날짜 `.jsonl`을 통째로 읽어 대상 라인만 제외하고 다시 씀(append-only라 collect-and-rewrite 필요, 30명 규모라 성능 문제없음). 첨부파일이 있으면 함께 `fs.unlink`. 삭제 성공 시 전체 접속자에 `deleted` 브로드캐스트.
- 첨부파일명: `crypto.randomBytes(4)` 해시를 원본 파일명 확장자 앞에 붙여 저장(`sanitizeBaseName`으로 경로 구분자 등 위험 문자만 치환) — 다운로드해도 원래 무슨 파일인지 알아볼 수 있으면서 이름 충돌은 없음. 업로드 용량은 클라이언트·서버 양쪽에서 10MB로 제한(서버 쪽은 base64 디코딩 후 실바이트 크기로 재검증, defense in depth).
- Markdown 내보내기: 선택 날짜의 `.jsonl`을 읽어 그 자리에서 Markdown으로 변환해 응답(별도 저장 불필요). 이미지 메시지는 `images/<date>/` 경로를 Markdown 이미지 링크로 삽입.
- 공유 파일: 관리자가 지정한 절대경로를 서버가 기억(재시작 시 재지정), 하위 디렉토리 포함 `fs.readdir(recursive)`로 목록 제공. 다운로드 API는 지정 루트 하위로 경로를 검증(`path.resolve` 후 루트 접두사 확인)해 경로 탈출 차단.

## 6. 통신 프로토콜

- REST(HTTP): 로그인(관리자/수강생), 공유 디렉토리 지정·목록 조회, 파일 다운로드, 날짜 목록 조회, Markdown 내보내기, 서버 LAN 주소 조회(관리자 전용).
- WebSocket: 접속 시 handshake(닉네임/식별자/역할 전달) 이후 실시간 메시지 송수신·삭제·유저 목록 갱신 브로드캐스트. 메시지 종류는 `text` / `image` / `file` / `system`(입퇴장) / `deleted` 정도로 단순 구분.

## 7. 인증/권한

- 로그인 성공 시 서버가 JWT 발급(payload: `role`, `nickname`, `identifier`, 짧은 만료시간). 쿠키 없이 클라이언트가 보관, REST는 `Authorization: Bearer`, WebSocket은 연결 URL 쿼리로 전달. 별도 인증 라이브러리(Passport 등) 불필요 — `jsonwebtoken`으로 서명/검증만 하면 됨.
- 서명 시크릿은 서버 기동 시 1회 생성해 메모리에만 보관(재기동 시 기존 토큰 전부 무효화 — 사용자 비영속 요구와 맥락 일치).
- 고유식별자 충돌 검사: 접속 시 서버 메모리 Map에 동일 식별자 존재하면 접속 거부 응답 → 클라이언트 재입력 유도.
- 패스워드는 어떤 형태로도 파일/DB에 저장하지 않음. 환경변수 값과 입력값을 `crypto.timingSafeEqual`로 비교만 하고 즉시 폐기.

## 8. 미포함(YAGNI)

- DB(SQLite 포함) — 파일시스템 append-only 로그로 충분, 검색/집계 요구 없음.
- Redis/메시지 브로커 — 단일 프로세스, 30명 규모라 불필요. 다중 인스턴스 확장 필요해지면 그때 도입.
- Redux 등 별도 상태관리 라이브러리 — 화면·상태 규모상 React 기본 state로 충분.
- 리프레시 토큰/토큰 재발급 플로우 — 강의 시간(1~2교시) 내 만료 안 되는 길이로 발급, 필요해지면 추가.
- 패스워드 해싱/영속 저장(scrypt, `auth.json`), 앱 내 최초 설정 화면 — 환경변수 주입 + 매 요청 직접 비교로 대체되어 불필요.

## 9. 확장 여지 (필요해지면)

- 동시 접속 수백 명 이상으로 늘면: WebSocket 다중 인스턴스 + Redis pub/sub 고려.
- 검색/통계 요구 생기면: `.jsonl` → SQLite 이전 고려.
