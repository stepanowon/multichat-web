# MultiChat Web API Spec

**버전:** 1.1
**작성일:** 2026-08-09
**최종 수정:** 2026-11-17 (설문 API, 첨부 서빙, 에러 코드·close 코드 보강, 강사 삭제 권한, `toNickname` 반영)
**관련 문서:** [1-prd.md](./1-prd.md), [2-stack.md](./2-stack.md), [3-wireframe.md](./3-wireframe.md)

---

## 0. 공통

- REST: 로그인/설정/파일목록/다운로드/대화내보내기처럼 요청-응답 1회성 작업.
- WebSocket: 접속 후 실시간 메시지·유저목록·공유파일 갱신처럼 서버 push가 필요한 작업.
- 인증: 로그인 성공 시 서버가 JWT 발급(서명 시크릿은 서버 메모리에만 존재 → 프로세스 재시작 시 기존 토큰 전부 무효). payload 예: `{ "role":"admin|student", "nickname":"...", "identifier":"...", "sessionVersion":1, "iat":..., "exp":... }`.
  - 토큰 만료는 8시간.
  - REST: `Authorization: Bearer <JWT>` 헤더. `<a href>`로 여는 다운로드 링크(1.5, 1.9, 1.10 export)용으로 `?token=<JWT>` 쿼리도 허용(헤더가 우선).
  - WebSocket: 연결 URL 쿼리 `?token=<JWT>` (연결 직후 서버가 검증, 실패 시 즉시 close).
  - 만료/서명 불일치 시 REST는 401 `{ "error":"INVALID_TOKEN" }`, WebSocket은 close(4401).
  - 서버는 식별자별 현재 `sessionVersion`을 메모리에 유지, 토큰의 `sessionVersion`이 이보다 낮으면 즉시 무효 처리(REST 401, WebSocket close 4401)한다.
  - 관리자가 강제 종료한 경우 서버가 해당 식별자의 `sessionVersion`을 증가시켜 기존 토큰을 즉시 무효화하고, WebSocket은 close(4403)한다. 같은 토큰으로 재연결/REST 요청은 이후 401/4401로 거부됨.
- 에러 응답 공통 포맷: `{ "error": "CODE", "message": "..." }` — `message`는 사용자에게 그대로 보여줄 문구가 있을 때만(설문 검증 등) 포함, 대부분은 `error`만.
- 권한 없는 역할의 요청은 403 `{ "error":"FORBIDDEN" }`.

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
{ "token": "string", "role": "admin", "identifier": "admin-<uuid>", "nickname": "강사" }
```

강사 식별자는 로그인마다 새로 만든다(강사 탭 여러 개가 각각 다른 식별자).

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

응답 400 (빈 칸 — 닉네임/식별자가 공백뿐이거나 문자열이 아닌 경우 포함): `{ "error": "MISSING_FIELDS" }`
응답 400 (닉네임/식별자가 trim 후 "강사"와 완전 일치 — 예약된 이름): `{ "error": "RESERVED_NAME" }`
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

부수효과: 성공 시 전체 접속자에 WebSocket `share_updated` push.
지정 경로는 메모리에만 보관 — 서버 재기동 시 다시 지정해야 한다.

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
응답 400 (지정 루트 밖 경로 — 경로 탈출 시도, 절대경로, 디렉토리, 존재하지 않는 파일): `{ "error": "INVALID_PATH" }`
응답 404 (공유 디렉토리 미지정): `{ "error": "NOT_FOUND" }`

### 1.6 대화 날짜 목록

`GET /api/messages/dates`  (Authorization 필요)

응답 200
```json
{ "dates": ["2026-08-08", "2026-08-09"] }
```

역할별 필터: student는 본인이 관여한(전체 브로드캐스트 포함) 메시지가 있는 날짜만. 날짜는 한국 시간(KST) 기준으로 나뉜다.

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

응답 400: `date` 누락 `{ "error":"MISSING_DATE" }`, `YYYY-MM-DD` 형식 아님 `{ "error":"INVALID_DATE" }` (1.9도 동일). 대화가 없는 날짜는 빈 배열.

### 1.8 서버 접속 주소 조회 (관리자 전용)

`GET /api/server-info`  (Authorization 필요, role=admin)

응답 200
```json
{ "port": "5000", "addresses": ["172.30.1.29"], "protocol": "http" }
```

`protocol`은 서버가 실제로 떠 있는 방식(`http`, 인증서가 있으면 `https`). 화면은 `<protocol>://<address>:<port>`로 안내한다.
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

- 시스템 메시지(입퇴장)는 강사본에도 포함하지 않는다. student 요청 시 1.7과 동일한 필터(본인 무관 1:1 제외) 적용 후 변환.
- 1:1 표기: 학생 → 강사는 `홍길동 → 강사`, 강사 → 학생은 `강사 → <받는 사람 닉네임>`. 닉네임은 메시지의 `toNickname`을 쓰고, 이 필드가 없는 예전 로그는 같은 날 로그의 발신·입장 기록에서 찾는다(못 찾으면 식별자). 이 이름 해석에만 그날 전체 로그를 참고하며, 파일에 들어가는 메시지는 위 필터를 그대로 따른다.
- 시각은 서버 로컬 시간대 `HH:MM`.

### 1.10 설문

설문은 날짜와 무관하게 `data/surveys.json` 한 파일에 누적 저장된다. 생성·응답·마감·삭제가 일어나면 서버가 전체 접속자에게 WS `survey_updated`를 보낸다(2.2).

질문 정의: `{ "type":"choice", "text":"...", "options":["A","B"], "multiple":false }` 또는 `{ "type":"text", "text":"..." }`
- 질문 1~50개, 질문 내용 최대 500자, 다지선다 선택지 2~20개(각 최대 200자), `multiple:true`면 복수 선택 허용.
- 응답 `answers[i]`: 다지선다는 선택지 인덱스 배열(`[0]`, 복수면 `[0,2]`), 단답형은 문자열(최대 1000자). 모든 질문 필수.

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| `GET` | `/api/surveys` | 전체 | 목록(최신순) `{ "surveys":[{ "id","title","createdAt","closed","questionCount","responseCount","answered" }] }` — `answered`는 student 본인 응답 여부 |
| `POST` | `/api/surveys` | admin | `{ "title":"...", "questions":[...] }` → 201 `{ "survey":{...} }`, 검증 실패 400 `{ "error":"INVALID_SURVEY", "message":"..." }` |
| `GET` | `/api/surveys/:id` | 전체 | `{ "survey":{ id,title,createdAt,closed,questions:[{id,type,text,options?,multiple?}] }, "results":{...}, "myAnswers":[...]\|null }` |
| `POST` | `/api/surveys/:id/responses` | student | `{ "answers":[...] }` — 1인 1응답, 다시 보내면 덮어씀(마감 전까지 수정 가능). 마감 시 409 `SURVEY_CLOSED`, 검증 실패 400 `INVALID_ANSWERS` |
| `PATCH` | `/api/surveys/:id` | admin | `{ "closed":true\|false }` 마감/재개 → `{ "survey":{...} }`. `closed`가 boolean이 아니면 400 `INVALID_BODY` |
| `DELETE` | `/api/surveys/:id` | admin | 설문과 응답 전체 삭제 → `{ "ok":true }` |
| `GET` | `/api/surveys/:id/export` | 전체 | 결과 Markdown 다운로드(`<a href>`용이라 `?token=` 쿼리 인증 허용). `Content-Disposition: attachment; filename*=UTF-8''설문결과_<제목>.md`. 이름 포함 규칙은 `results`와 동일(admin만 응답자 표시) |

`results`: `{ "responseCount":2, "questions":[ { "counts":[1,0,1] }, { "answers":[{ "text":"..." }] } ] }`
- student에게는 **익명 집계만** 내려간다(선택지별 인원 수, 단답 내용).
- admin에게는 응답자 이름이 추가된다: 다지선다 `"voters":[["홍길동"],[],["김철수"]]`, 단답형 `{ "text":"...", "nickname":"홍길동" }`.

공통 에러: 없는 설문 404 `{ "error":"NOT_FOUND" }`, 역할 불일치 403 `FORBIDDEN`.

결과 Markdown 구성: 제목, 상태(진행 중/마감)·생성 시각·응답 수·내보낸 시각(KST), 다지선다는 질문별 표(선택지 | 응답 수 | 비율, admin은 `응답자` 열 추가), 단답형은 목록(admin은 `**이름**: 답변`), 응답이 없으면 `_응답 없음_`. 사용자 입력의 줄바꿈·`|`·줄 앞 `#`·`>`·목록 기호는 Markdown 구조를 깨지 않도록 이스케이프.

### 1.11 채팅 첨부파일 (인증 없음)

`GET /attachments/images/<date>/<저장파일명>` — 메시지의 `attachmentPath`(`images/<date>/<name>`) 앞에 `/attachments/`를 붙인 경로.

- `data/messages/images/` 하위만 공개. 대화 로그(`.jsonl`) 등 그 밖의 파일은 404.
- 응답에 항상 `Content-Disposition: attachment; filename="<저장파일명>"`, `X-Content-Type-Options: nosniff` — 업로드된 `.html`/`.svg`가 브라우저에서 열리지 않고 다운로드된다(`<img>` 표시는 그대로 동작).
- 인증 없는 공개 경로라 파일명의 랜덤 해시(8자리 hex)에 의존한다. 접근 통제가 필요해지면 인증 미들웨어 추가.

---

## 2. WebSocket

### 2.1 연결

`ws(s)://<host>/ws?token=<token>`

- 연결 즉시 서버가 token 검증 → 실패 시 close(4401).
- student의 식별자로 이미 다른 연결이 있으면 close(4409). (로그인 시점 409에 이어 접속 시점에도 확인)
- 성공 시 서버 → 클라이언트로 `welcome` 전송.
  - student 접속: admin 전원에게 `system`(입장) + `user_list` 브로드캐스트.
  - admin 접속: 본인에게 현재 `user_list`를 바로 전송. admin은 같은 토큰으로 여러 연결(탭)을 가질 수 있고, 연결마다 모든 알림을 받는다.
- 한 프레임이 15MB를 넘으면 서버가 연결을 끊는다(close 1009). 클라이언트는 5초 후 재연결.

| close 코드 | 의미 | 클라이언트 동작 |
|---|---|---|
| 4401 | 토큰 무효(만료, 서버 재기동, 강제 종료 후 재사용) | 세션 삭제 → 로그인 화면 |
| 4403 | 강사가 강제 종료 | 세션 삭제 → 안내 alert → 로그인 화면 |
| 4409 | 같은 식별자로 이미 접속 중 | 재연결 시도 |
| 그 외 | 네트워크 단절·서버 재기동 등 | 5초 후 자동 재연결 |

### 2.2 서버 → 클라이언트 메시지

공통 포맷: `{ "type": "...", ...payload }`

| type | 대상 | 설명 |
|---|---|---|
| `welcome` | 접속 본인 | `{ "type":"welcome", "role":"student", "nickname":"홍길동" }` |
| `message` | 관련자(전체 or 강사 or 1:1 당사자) | `{ "type":"message", "id":"uuid", "msgType":"text\|image\|file", "from":"홍길동", "fromIdentifier":"s01", "role":"student", "to":"all\|admin\|<identifier>", "toNickname":"영희(1:1일 때만)", "text":"...", "attachmentPath":"...", "fileName":"...", "ts":"ISO8601" }` |
| `system` | **admin만** | `{ "type":"system", "event":"join\|leave", "nickname":"홍길동", "identifier":"s01", "ts":"..." }` (student에게는 절대 전송 안 함). 날짜별 로그에도 저장. 화면은 대화창에 넣지 않고 토스트로 표시 |
| `user_list` | **admin만** | `{ "type":"user_list", "users":[{"nickname":"홍길동","identifier":"s01"}, ...] }` (수강생만, admin 미포함) |
| `share_updated` | 전체 | `{ "type":"share_updated" }` — 수신 시 수강생 화면이 1.4 재조회 |
| `deleted` | 전체 | `{ "type":"deleted", "id":"uuid" }` — 화면에 해당 id 메시지가 있으면 제거(없으면 무시) |
| `survey_updated` | 전체 | `{ "type":"survey_updated", "id":"uuid" }` — 설문 생성/응답/마감/삭제 시. 수신 시 클라이언트가 1.10 목록(과 열려 있는 설문 상세)을 재조회 |
| `error` | 접속 본인 | `{ "type":"error", "code":"...", "message":"..." }` |

### 2.3 클라이언트 → 서버 메시지

| type | 발신 가능 역할 | 설명 |
|---|---|---|
| `message` | admin, student | `{ "type":"message", "msgType":"text\|image\|file", "to":"all\|admin\|<identifier>", "text":"...", "imageData":"base64(image only, 10MB 이내)", "fileData":"base64(file only, 10MB 이내)", "fileName":"..." }` — student는 `to`가 `"all"`(전체 사용자) 또는 `"admin"`(강사에게만)만 가능(그 외 값은 서버가 `"admin"`으로 강제), admin만 특정 identifier 지정 가능. 10MB 초과 시 서버가 `error`(`FILE_TOO_LARGE`)로 거부 |
| `delete` | admin, student | `{ "type":"delete", "id":"uuid", "date":"YYYY-MM-DD" }` — student는 본인이 보낸 메시지만, admin은 모든 메시지 삭제 가능(권한 없는 요청은 서버가 조용히 무시) |
| `kick` | admin | `{ "type":"kick", "identifier":"s01" }` — 지정 identifier의 `sessionVersion`을 증가시켜 기존 토큰을 무효화하고 학생 세션을 강제 종료(close 4403). admin이 아니거나 대상이 학생이 아니면 조용히 무시 |

입력 검증: 알 수 없는 `type`, JSON이 아닌 프레임, 문자열이어야 할 필드(`text`·`imageData`·`fileData`·`fileName`·`to`·`id`·`identifier`)가 다른 타입이거나 `date`가 형식에 안 맞는 메시지는 조용히 무시한다. 핸들러 안의 예외는 그 메시지 하나의 실패로 끝나고 서버는 계속 동작한다.

서버 처리(message): 수신 즉시 날짜(KST)별 `.jsonl`에 append 저장(이미지/파일은 `data/messages/images/<date>/`에 `원본이름.해시8자리.확장자`로 별도 저장 후 경로만 로그에 기록) → 수신 대상에 따라 전송.
- `to:"all"` → 전원.
- `to:"admin"` → admin 전원 + 발신자 본인.
- `to:<identifier>`(admin만) → 그 수강생 + 발신자 본인. 받는 사람 닉네임을 `toNickname`으로 함께 저장·전송.

서버 처리(delete): 발신자 본인 메시지인지(admin은 생략) 확인 후 로그 파일에서 제거(첨부 파일도 함께 삭제) → 성공 시 전체 접속자에게 `deleted` 브로드캐스트.

### 2.4 종료

- 클라이언트 연결 종료(탭 닫기 등) 감지 시 서버가 그 연결의 세션을 제거, 수강생이면 admin 전원에 `system`(leave) + `user_list` 갱신 브로드캐스트. student에는 전송 안 함(PRD 6항).
- admin이 `kick`으로 강제 종료한 경우도 동일한 close 처리 흐름(세션 제거 + `system`/`user_list` 브로드캐스트)을 타되, close 코드가 4403이라 학생 클라이언트는 재연결을 시도하지 않고 즉시 로그인 화면으로 이동(세션 정보 삭제).

---

## 3. 화면-API 매핑 요약

| 화면 | 사용 API |
|---|---|
| S1 진입 | `POST /api/login/admin`, `POST /api/login/student` |
| S2 관리자 채팅 | WS 연결, `GET /api/server-info`, `GET /api/messages/dates`, `GET /api/messages`, `GET /api/messages/export`, `GET /attachments/images/...`, WS `message`/`delete`/`kick` 전송, `message`/`system`/`user_list`/`deleted`/`survey_updated`/`error` 수신 |
| S3 수강생 채팅 | WS 연결, `GET /api/messages/dates`, `GET /api/messages`, `GET /api/messages/export`, `GET /api/share/files`, `GET /api/share/download`, `GET /attachments/images/...`, WS `message`/`delete` 전송, `message`/`share_updated`/`deleted`/`survey_updated`/`error` 수신 |
| S4 공유 디렉토리 지정 | `POST /api/share/dir` |
| S5 설문 | `GET /api/surveys`, `GET /api/surveys/:id`, `GET /api/surveys/:id/export`, (admin) `POST`/`PATCH`/`DELETE /api/surveys...`, (student) `POST /api/surveys/:id/responses`, WS `survey_updated` |
