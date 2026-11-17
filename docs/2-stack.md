# MultiChat Web 기술 스택 설계

**버전:** 1.1
**작성일:** 2026-08-09
**최종 수정:** 2026-11-18 (인증 정보 전역 store(zustand) 도입)
이전: 2026-11-17 (연결 단위 세션, 설문 저장, KST 날짜 기준, HTTPS, 입력 방어, 프론트 공통 훅 반영)
**관련 문서:** [1-prd.md](./1-prd.md)

---

## 1. 설계 원칙

- 동시 접속 30명 규모 → DB 서버, 별도 인증 서버 등 불필요. 파일시스템 + 단일 프로세스로 충분.
- 사용자 정보 비영속 요구 → DB 대신 프로세스 메모리로 세션 관리.
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
| 세션/사용자 목록 | 메모리 `Set` — WS 연결 1개당 `{identifier, nickname, role, ws}` 1건(`server/src/state.js`) | 비영속 요구, 프로세스 재시작 시 초기화되는 게 오히려 요구사항에 부합. 식별자 단위 Map이면 같은 식별자의 연결이 둘 생길 때(강사 탭 복제, 재연결 시 옛 소켓 close 지연) 서로의 세션을 덮어쓰거나 지워 실시간 알림을 못 받는 화면이 생기므로 연결 단위로 보관. 수강생은 식별자 중복 접속을 막으므로 여러 연결을 갖는 건 강사뿐 |
| 관리자/공통 패스워드 | 환경변수 `ADMIN_PASSWORD`, `STUDENT_PASSWORD`로 주입, 기동 시 `process.env`에서 로드 | 파일/DB 저장·해싱·초기설정 화면 자체가 불필요해짐(입력값을 `crypto.timingSafeEqual`로 직접 비교) |
| `.env` 로드 | Node 내장 `--env-file-if-exists=.env`(`package.json` start/dev 스크립트에 지정) | `dotenv` 패키지 불필요, 파일 없어도 에러 없이 기동 |
| 프론트 빌드 | `server/package.json`의 `predev`가 `cd ../frontend && npm run build` 실행. 빌드 산출물 `server/static`은 저장소에 커밋 | 배포(`npm start`)는 커밋된 `server/static`을 그대로 서빙하므로 강의장 PC에 프론트 빌드 환경이 없어도 됨. 대신 프론트를 고치면 `npx vite build`로 산출물을 갱신해 함께 커밋 |
| 정적 파일 서빙 | Express `static` (React 빌드 결과물, `frontend`가 `server/static`으로 직접 빌드) | 별도 프론트 서버 불필요, 빌드 산출물만 서빙 |
| 채팅 첨부 서빙 | `/attachments/images/*` — `data/messages/images/`만 Express `static`으로 공개, 응답에 항상 `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` | 상위의 대화 로그(`.jsonl`)는 URL로 접근 불가. 수강생이 올린 `.html`/`.svg`가 같은 출처에서 렌더링·실행되지 않음(`<img>` 표시는 그대로 동작) |
| HTTPS(선택) | 저장소 루트 `certs/key.pem`·`cert.pem`이 있으면 `https.createServer`, 없으면 `http.createServer` | 자체서명 인증서만 두면 코드 변경 없이 전환. 강의장 IP가 바뀌면 인증서만 재발급(README 참고). `certs/`는 gitignore |
| WS 입력 방어 | `maxPayload` 15MB, 소켓 `error` 리스너, 메시지 핸들러 전체 try/catch + 필드 타입 검증, 핸들러 디스패치는 `Object.hasOwn` | 예외 하나가 새면 프로세스가 죽고, 재기동 시 JWT 시크릿이 바뀌어 전원이 재로그인해야 함 — 수강생 한 명의 잘못된 메시지가 강의 전체를 끊지 않도록 |
| JWT | `jsonwebtoken` (npm) | 서명/검증 표준 구현, 직접 구현할 이유 없음 |
| 강사용 접속 주소 안내 | `GET /api/server-info`(관리자 전용) — Node 내장 `os.networkInterfaces()`로 LAN IPv4 조회, link-local(169.254.x.x) 제외 | 수강생에게 알려줄 접속 주소를 강사가 직접 `ipconfig` 안 쳐도 화면에서 바로 확인 |
| 크래시 자동 재시작 | `server/scripts/keep-alive.js` — `npm start`가 이 래퍼를 실행, 자식 프로세스(`src/index.js`)가 죽으면 1초 후 재기동. `child_process.spawn` + `setTimeout` 몇 줄로 충분 | 30명 규모 단일 인스턴스에 forever/pm2 같은 프로세스 매니저는 과함. Ctrl+C(SIGINT/SIGTERM)는 래퍼가 자식에 전달 후 정상 종료, 재시작 안 함 |

## 4. 프론트엔드

| 항목 | 선택 | 이유 |
|---|---|---|
| 구조 | React + Vite | 요건상 React 지정. 화면 수 적어 라우팅 없이 로그인 상태로 컴포넌트만 분기 |
| 상태 관리 | 인증 정보만 `zustand` 전역 store(`authStore.js`의 `useAuth`), 나머지는 React 기본 state(페이지·훅 로컬) | 로그인 정보는 컴포넌트 밖(`api.js` 토큰 헤더, `ws.js` 접속 토큰)에서도 읽고, 로그아웃도 그곳들(REST 401, WS 4401·4403, 끊긴 소켓 전송)에서 일어남 — `useAuth.getState().logout()` 하나로 모아 페이지 새로고침 없이 로그인 화면으로 전환. Provider 불필요·약 1KB라 값 4개를 위해 Redux를 들이는 것보다 가벼움. 채팅 메시지·설문·접속자 목록은 한 화면에서만 쓰이고 WS 연결과 수명이 같아 전역에 두지 않음(로그아웃 시 화면 언마운트로 함께 정리) |
| 화면 구성 | 페이지 2개(`AdminChat`/`StudentChat`) + 공통 훅·컴포넌트. 날짜 목록·메시지 조회·WS 연결/전송은 `useChatRoom`, 상단 바는 `ChatTopBar`, 대화 영역(목록·입력·드롭)은 `ChatPane`, 설문 목록 상태는 `useSurveys` | 두 화면의 차이(사이드바, 화면별 WS 이벤트)만 페이지에 남기고 나머지는 한 곳에서 관리 |
| 파일 첨부 경로 | 드래그앤드롭·클립보드 붙여넣기·`＋` 버튼 모두 `useFileDrop`의 `deliver` 한 함수로 처리(크기 검사 → base64 → 전송) | 경로마다 크기 검사·오류 표시가 달라지는 것 방지 |
| 비보안 컨텍스트 대응 | `crypto.randomUUID`, `navigator.clipboard` 등 https/localhost 전용 API에 의존하지 않음(토스트 id는 일련번호, 복사는 `execCommand` 폴백) | 수강생은 `http://<LAN IP>`로 접속 — 이런 API는 아예 존재하지 않아 오류가 남 |
| 입퇴장 알림 | 강사 화면 상단 토스트(3초 후 사라짐), 대화창에는 추가하지 않음 | 수강생이 많으면 입퇴장 줄이 대화를 밀어냄. 기록은 서버 로그에 그대로 남음 |
| 실시간 수신 | 브라우저 내장 `WebSocket` API, 얇은 재연결 래퍼(`connectChatSocket`) | 서버 재기동·네트워크 순단으로 연결이 끊기면(토큰 무효 4401·강제 종료 4403 제외) 5초 후 자동 재연결. 재연결 대기 중 로그아웃되면(`close()`) 예약된 재연결은 취소. 별도 라이브러리(reconnecting-websocket 등) 없이 `setTimeout` + 재오픈으로 충분 |
| 클립보드 이미지 붙여넣기 | `window`에 `paste` 리스너(문서 전체) + `ClipboardEvent.clipboardData.items` | 좁은 입력창에만 걸면 캡처 후 포커스가 body에 가 있어 안 잡히는 경우가 많아 문서 전체로 확대 |
| 파일 드래그앤드롭 | 채팅 영역(`main-pane`) 전체에 `onDrop`, `window`에는 `dragover`/`drop` 기본동작만 차단 | 입력창처럼 좁은 영역만 드롭 대상이면 대부분 빗나가 브라우저가 파일을 새 탭으로 열어버림 |
| 여러 줄 입력 | `<textarea>` + Enter=전송/Shift+Enter=줄바꿈 | 네이티브 요소, 라이브러리 불필요 |
| 메시지 복사/삭제/이미지 다운로드 컨텍스트 메뉴 | `contextmenu` 이벤트 가로채서 커스텀 메뉴(항목 배열) 표시 | 표준 API, 항목만 늘리면 되는 구조 |
| 클립보드 쓰기 | `navigator.clipboard.writeText` + `document.execCommand("copy")` 폴백 | `navigator.clipboard`는 보안 컨텍스트(https/localhost)에서만 존재 — 학생들이 접속하는 LAN IP+HTTP는 비보안 컨텍스트라 폴백 필수 |
| 이미지 확대보기 | 클릭 시 상태로 제어하는 전체화면 오버레이(CSS `position:fixed`) | 별도 라이트박스 라이브러리 불필요 |
| 날짜 선택 드롭다운 | `<select>` 네이티브 요소 | 커스텀 드롭다운 라이브러리 불필요 |
| JWT 저장 | `sessionStorage`(키 `auth`, zustand `persist` 미들웨어로 저장·복원) | 탭 종료 시 자동 만료(요건상 사용자 정보 비영속과 맥락 일치). 탭 단위라 한 브라우저에서 강사 탭·수강생 탭을 따로 띄울 수 있음 |
| WS 전송 가드 | `ws.readyState === WebSocket.OPEN` 확인 후 send, 아니면 안내 | 접속 직후 CONNECTING 상태에서 바로 보내면 예외가 이벤트 핸들러 안에서 조용히 죽어 "반응 없음"으로 보임 |
| 개발 서버 LAN 노출 | `vite.config.js`의 `server.host: true` | 기본은 localhost만 바인딩 — 원격 학생이 개발 서버로 접속하려면 필요 |
| 개발 프록시 안정성 | 프록시별 `configure(proxy)`에서 `proxy.on("error", ...)` 등록 | 탭 종료/새로고침으로 요청이 중간에 끊기면 `ECONNABORTED`가 uncaught exception으로 던져져 dev 서버 자체가 죽는 문제 방지 |
| 메시지 시간 표시 | 저장은 UTC ISO 문자열 그대로, 화면 표시만 `new Date(ts).toLocaleTimeString()`로 변환 | 문자열을 그대로 잘라 쓰면 GMT+0으로 보임 — 브라우저 로케일 타임존으로 변환해야 실제 시간과 맞음. Markdown 내보내기(서버 측)도 동일하게 `toLocaleTimeString()`으로 서버 로컬 시간대 표기 |
| 날짜 구분 | 한국 시간(UTC+9) 기준 `YYYY-MM-DD`. 서버 `server/src/time.js`(`kstDate`, `formatKst`), 프론트 `frontend/src/time.js`(`todayKst`) 한 곳씩 | UTC 날짜로 자르면 오전 9시 전 메시지가 전날로 들어감. 서버·프론트 기준이 같아야 "오늘" 대화가 맞게 보이므로 바꿀 때는 두 파일을 함께 수정 |

## 5. 데이터 저장 (파일시스템 레이아웃)

```
data/
  messages/
    2026-08-09.jsonl        # 그 날짜의 모든 메시지(1줄 1메시지, JSON)
    images/
      2026-08-09/
        test.a1b2c3d4.js      # "원본이름.해시8자리.확장자" — 붙여넣기 이미지/드래그앤드롭 파일 원본
  surveys.json                # 모든 설문 정의 + 응답(날짜 무관 누적)
```

공유 디렉토리는 `data/` 아래가 아니라 관리자가 지정한 서버의 임의 절대경로를 그대로 서빙한다.

- 날짜(파일명)는 한국 시간 기준(4장 표의 "날짜 구분" 참고).

- 메시지 로그: 날짜별 `.jsonl`(append-only) → 동시쓰기 단순, DB 없이 날짜별 대화 조회/필터 용이.
- 메시지 삭제: 본인 것인지(강사는 생략) 확인 후 해당 날짜 `.jsonl`을 통째로 읽어 대상 라인만 제외하고 다시 씀(append-only라 collect-and-rewrite 필요, 30명 규모라 성능 문제없음). 첨부파일이 있으면 함께 `fs.unlink`. 삭제 성공 시 전체 접속자에 `deleted` 브로드캐스트.
- 첨부파일명: `crypto.randomBytes(4)` 해시를 원본 파일명 확장자 앞에 붙여 저장(`server/src/sanitize.js`의 `sanitizeFileName`으로 경로 구분자·Windows 예약 문자·제어 문자만 `_`로 치환 — 설문 결과 파일명도 같은 함수 사용) — 다운로드해도 원래 무슨 파일인지 알아볼 수 있으면서 이름 충돌은 없음. 업로드 용량은 클라이언트·서버 양쪽에서 10MB로 제한(서버 쪽은 base64 디코딩 후 실바이트 크기로 재검증, defense in depth).
- Markdown 내보내기: 선택 날짜의 `.jsonl`을 읽어 그 자리에서 Markdown으로 변환해 응답(별도 저장 불필요). 이미지 메시지는 `images/<date>/` 경로를 Markdown 이미지 링크로 삽입. 강사의 1:1 메시지는 저장 시 기록한 `toNickname`으로 받는 사람을 표기하고, 이 필드가 없는 예전 로그는 같은 날 로그의 발신·입장 기록에서 식별자→닉네임을 찾아 채운다(못 찾으면 식별자).
- 설문: `data/surveys.json` 한 파일에 전체를 담고, 변경할 때마다 임시파일에 쓴 뒤 `rename`으로 교체(쓰는 도중 죽어도 반쯤 쓴 파일이 남지 않음). 파일이 깨져 읽을 수 없으면 `surveys.json.corrupt-<시각>`으로 백업하고 빈 목록으로 시작. 결과 집계는 조회 시마다 응답에서 계산(30명 × 설문 수십 개 규모라 캐시 불필요).
- 공유 파일: 관리자가 지정한 절대경로를 서버가 기억(재시작 시 재지정), 하위 디렉토리 포함 `fs.readdir(recursive)`로 목록 제공. 다운로드 API는 지정 루트 하위로 경로를 검증(`path.resolve` 후 루트 접두사 확인)해 경로 탈출 차단.

## 6. 통신 프로토콜

- REST(HTTP): 로그인(관리자/수강생), 공유 디렉토리 지정·목록 조회, 파일 다운로드, 날짜 목록·대화 조회, Markdown 내보내기, 서버 LAN 주소 조회(관리자 전용), 설문 생성·조회·응답·마감·삭제·결과 내보내기.
- WebSocket: 접속 시 JWT 검증 이후 실시간 메시지 송수신·삭제·강제 종료·유저 목록 갱신 브로드캐스트. 메시지 종류는 `text` / `image` / `file` / `system`(입퇴장) / `deleted` 정도로 단순 구분. 공유 폴더·설문 변경은 내용 없이 "바뀌었음"(`share_updated`, `survey_updated`)만 알리고 클라이언트가 REST로 다시 조회 — 권한별로 다른 결과(익명/실명)를 WS에서 따로 만들 필요가 없음.
- 상세 스펙은 [4-api.md](./4-api.md).

## 7. 인증/권한

- 로그인 성공 시 서버가 JWT 발급(payload: `role`, `nickname`, `identifier`, `sessionVersion`, 만료 8시간 — 하루 강의 동안 재로그인 불필요). 쿠키 없이 클라이언트가 보관, REST는 `Authorization: Bearer`, WebSocket은 연결 URL 쿼리로 전달. 별도 인증 라이브러리(Passport 등) 불필요 — `jsonwebtoken`으로 서명/검증만 하면 됨.
- 서명 시크릿은 서버 기동 시 1회 생성해 메모리에만 보관(재기동 시 기존 토큰 전부 무효화 — 사용자 비영속 요구와 맥락 일치).
- `<a href>` 다운로드 링크(대화·설문 내보내기, 공유 파일)는 헤더를 붙일 수 없어 `?token=` 쿼리로도 인증.
- 강제 종료: 식별자별 `sessionVersion`을 메모리에 두고, 강사가 내보내면 값을 올려 그 사람의 기존 토큰을 즉시 무효화.
- 고유식별자 충돌 검사: 로그인 시 같은 식별자로 접속 중인 수강생이 있으면 409로 거부 → 클라이언트 재입력 유도. WS 접속 시점에도 한 번 더 확인(close 4409).
- 패스워드는 어떤 형태로도 파일/DB에 저장하지 않음. 환경변수 값과 입력값을 `crypto.timingSafeEqual`로 비교만 하고 즉시 폐기.

## 8. 미포함(YAGNI)

- DB(SQLite 포함) — 파일시스템 append-only 로그로 충분, 검색/집계 요구 없음.
- Redis/메시지 브로커 — 단일 프로세스, 30명 규모라 불필요. 다중 인스턴스 확장 필요해지면 그때 도입.
- Redux — 전역 상태가 인증 정보 하나뿐이라 slice·Provider 구성이 과함. 필요한 전역 상태는 zustand로 충분.
- 리프레시 토큰/토큰 재발급 플로우 — 강의 시간(1~2교시) 내 만료 안 되는 길이로 발급, 필요해지면 추가.
- 패스워드 해싱/영속 저장(scrypt, `auth.json`), 앱 내 최초 설정 화면 — 환경변수 주입 + 매 요청 직접 비교로 대체되어 불필요.
- forever/pm2 등 프로세스 매니저 — 크래시 시 재시작만 필요한 단일 인스턴스라 `spawn`+`setTimeout` 몇 줄(`keep-alive.js`)로 충분, 클러스터링/로그로테이션 같은 기능은 이 규모에 불필요.

## 9. 확장 여지 (필요해지면)

- 동시 접속 수백 명 이상으로 늘면: WebSocket 다중 인스턴스 + Redis pub/sub 고려.
- 검색/통계 요구 생기면: `.jsonl` → SQLite 이전 고려.
