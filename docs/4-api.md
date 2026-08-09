# MultiChat Web API Spec

**버전:** 1.0
**작성일:** 2026-08-09
**관련 문서:** [1-prd.md](./1-prd.md), [2-stack.md](./2-stack.md), [3-wireframe.md](./3-wireframe.md)

---

## 0. 공통

- REST: 로그인/설정/파일목록/다운로드/대화내보내기처럼 요청-응답 1회성 작업.
- WebSocket: 접속 후 실시간 메시지·유저목록·공유파일 갱신처럼 서버 push가 필요한 작업.
- 인증: 로그인 성공 시 서버가 JWT 발급(서명 시크릿은 서버 메모리에만 존재 → 프로세스 재시작 시 기존 토큰 전부 무효). payload 예: `{ "role":"admin|student", "nickname":"...", "identifier":"...", "iat":..., "exp":... }`.
  - REST: `Authorization: Bearer <JWT>` 헤더.
  - WebSocket: 연결 URL 쿼리 `?token=<JWT>` (연결 직후 서버가 검증, 실패 시 즉시 close).
  - 만료/서명 불일치 시 REST는 401 `{ "error":"INVALID_TOKEN" }`, WebSocket은 close(4401).
- 에러 응답 공통 포맷: `{ "error": "CODE", "message": "..." }`

---

## 1. REST API

관리자/수강생 패스워드는 서버 구동 시 환경변수(`ADMIN_PASSWORD`, `STUDENT_PASSWORD`)로 주입되므로 초기화 상태 확인·설정 API 없음. 로그인 시 서버가 입력값을 환경변수 값과 직접 비교.

### 1.1 관리자 로그인

`POST /api/login/admin`

요청
```json
{ "password": "string" }
```

응답 200
```json
{ "token": "string", "role": "admin" }
```

응답 401: `{ "error": "INVALID_PASSWORD" }`

### 1.2 수강생 로그인

`POST /api/login/student`

요청
```json
{ "nickname": "string", "identifier": "string", "password": "string" }
```

응답 200
```json
{ "token": "string", "role": "student", "nickname": "string", "identifier": "string" }
```

응답 401: `{ "error": "INVALID_PASSWORD" }`
응답 409 (식별자 충돌 — 이미 접속 중): `{ "error": "IDENTIFIER_TAKEN" }`

### 1.3 공유 디렉토리 지정 (관리자 전용)

`POST /api/share/dir`  (Authorization 필요, role=admin)

요청
```json
{ "path": "/srv/course/day1" }
```

응답 200: `{ "ok": true, "path": "/srv/course/day1" }`
응답 400 (존재하지 않는 경로/디렉토리 아님): `{ "error": "INVALID_PATH" }`
응답 403 (admin 아님): `{ "error": "FORBIDDEN" }`

부수효과: 성공 시 전체 수강생에 WebSocket `share_updated` push.

### 1.4 공유 파일 목록 조회

`GET /api/share/files`  (Authorization 필요)

응답 200
```json
{
  "root": "/srv/course/day1",
  "tree": [
    { "type": "dir", "name": "chapter1", "children": [
      { "type": "file", "name": "index.html", "path": "chapter1/index.html", "size": 1234 }
    ] },
    { "type": "file", "name": "readme.md", "path": "readme.md", "size": 200 }
  ]
}
```

응답 200 (미지정 시): `{ "root": null, "tree": [] }`

### 1.5 공유 파일 다운로드

`GET /api/share/download?path=chapter1/index.html`  (Authorization 필요)

응답 200: 파일 바이너리 스트림(`Content-Disposition: attachment`)
응답 400 (지정 루트 밖 경로 — 경로 탈출 시도): `{ "error": "INVALID_PATH" }`
응답 404: `{ "error": "NOT_FOUND" }`

### 1.6 대화 날짜 목록

`GET /api/messages/dates`  (Authorization 필요)

응답 200
```json
{ "dates": ["2026-08-08", "2026-08-09"] }
```

역할별 필터: student는 본인이 관여한(전체 브로드캐스트 포함) 메시지가 있는 날짜만.

### 1.7 대화 조회 (날짜 선택 시 화면 로딩용)

`GET /api/messages?date=2026-08-09`  (Authorization 필요)

응답 200
```json
{
  "date": "2026-08-09",
  "messages": [
    { "id": "uuid", "msgType": "text", "from": "홍길동", "fromIdentifier": "s01", "role": "student", "to": "admin", "text": "질문 있습니다", "ts": "2026-08-09T10:03:00+09:00" },
    { "id": "uuid", "msgType": "image", "from": "강사", "fromIdentifier": "admin-xxxx", "role": "admin", "to": "s01", "attachmentPath": "images/2026-08-09/image.a1b2c3d4.png", "ts": "2026-08-09T10:04:00+09:00" },
    { "type": "system", "event": "join", "nickname": "홍길동", "identifier": "s01", "ts": "2026-08-09T10:02:00+09:00" }
  ]
}
```

역할별 필터: student 응답에는 `type:"system"` 메시지 미포함, 본인이 받을 수 없는(다른 학생 대상 1:1) 메시지 제외.

### 1.8 서버 접속 주소 조회 (관리자 전용)

`GET /api/server-info`  (Authorization 필요, role=admin)

응답 200
```json
{ "port": "5000", "addresses": ["172.30.1.29"] }
```

`os.networkInterfaces()`로 서버 LAN IPv4를 조회(link-local `169.254.x.x`는 접속 불가라 제외). 강사 화면에 "수강생 접속 주소" 안내용.

### 1.9 대화 Markdown 내보내기

`GET /api/messages/export?date=2026-08-09`  (Authorization 필요)

응답 200: `Content-Type: text/markdown`, `Content-Disposition: attachment; filename="2026-08-09.md"`
본문 예시
```markdown
# 2026-08-09 대화 기록

### 10:03 홍길동
질문 있습니다 소켓 연결이...

### 10:04 강사 → 홍길동
![image](images/2026-08-09/image.a1b2c3d4.png)
```

student 요청 시 1.7과 동일한 필터(시스템 메시지 제외, 본인 무관 1:1 제외) 적용 후 변환.

---

## 2. WebSocket

### 2.1 연결

`ws(s)://<host>/ws?token=<token>`

- 연결 즉시 서버가 token 검증 → 실패 시 close(4401).
- 성공 시 서버 → 클라이언트로 `welcome` 전송, 동시에 admin 전원에게 `user_list`/`system`(입장) 브로드캐스트.

### 2.2 서버 → 클라이언트 메시지

공통 포맷: `{ "type": "...", ...payload }`

| type | 대상 | 설명 |
|---|---|---|
| `welcome` | 접속 본인 | `{ "type":"welcome", "role":"student", "nickname":"홍길동" }` |
| `message` | 관련자(전체 or 강사 or 1:1 당사자) | `{ "type":"message", "id":"uuid", "msgType":"text\|image\|file", "from":"홍길동", "fromIdentifier":"s01", "role":"student", "to":"all\|admin\|<identifier>", "text":"...", "attachmentPath":"...", "fileName":"...", "ts":"ISO8601" }` |
| `system` | **admin만** | `{ "type":"system", "event":"join\|leave", "nickname":"홍길동", "identifier":"s01", "ts":"..." }` (student에게는 절대 전송 안 함) |
| `user_list` | **admin만** | `{ "type":"user_list", "users":[{"nickname":"홍길동","identifier":"s01"}, ...] }` |
| `share_updated` | 전체 | `{ "type":"share_updated" }` — 수신 시 클라이언트가 1.4 재조회 |
| `deleted` | 전체 | `{ "type":"deleted", "id":"uuid" }` — 화면에 해당 id 메시지가 있으면 제거(없으면 무시) |
| `error` | 접속 본인 | `{ "type":"error", "code":"...", "message":"..." }` |

### 2.3 클라이언트 → 서버 메시지

| type | 발신 가능 역할 | 설명 |
|---|---|---|
| `message` | admin, student | `{ "type":"message", "msgType":"text\|image\|file", "to":"all\|admin\|<identifier>", "text":"...", "imageData":"base64(image only, 10MB 이내)", "fileData":"base64(file only, 10MB 이내)", "fileName":"..." }` — student는 `to`가 `"all"`(전체 사용자) 또는 `"admin"`(강사에게만)만 가능(그 외 값은 서버가 `"admin"`으로 강제), admin만 특정 identifier 지정 가능. 10MB 초과 시 서버가 `error`(`FILE_TOO_LARGE`)로 거부 |
| `delete` | admin, student | `{ "type":"delete", "id":"uuid", "date":"YYYY-MM-DD" }` — 본인이 보낸 메시지만 삭제 가능(다른 사람 것 요청 시 서버가 조용히 무시) |

서버 처리(message): 수신 즉시 날짜별 `.jsonl`에 append 저장(이미지/파일은 `data/messages/images/<date>/`에 별도 저장 후 경로만 로그에 기록) → 대상자에게 `message` 브로드캐스트.

서버 처리(delete): 발신자 본인 메시지인지 확인 후 로그 파일에서 제거(첨부 파일도 함께 삭제) → 성공 시 전체 접속자에게 `deleted` 브로드캐스트.

### 2.4 종료

- 클라이언트 연결 종료(탭 닫기 등) 감지 시 서버가 세션 Map에서 제거, admin 전원에 `system`(leave) + `user_list` 갱신 브로드캐스트. student에는 전송 안 함(PRD 6항).

---

## 3. 화면-API 매핑 요약

| 화면 | 사용 API |
|---|---|
| S1 진입 | `POST /api/login/admin`, `POST /api/login/student` |
| S2 관리자 채팅 | WS 연결, `GET /api/server-info`, `GET /api/messages/dates`, `GET /api/messages`, `GET /api/messages/export`, WS `message`/`system`/`user_list`/`deleted` |
| S3 수강생 채팅 | WS 연결, `GET /api/messages/dates`, `GET /api/messages`, `GET /api/messages/export`, `GET /api/share/files`, `GET /api/share/download`, WS `message`/`share_updated`/`deleted` |
| S4 공유 디렉토리 지정 | `POST /api/share/dir` |
