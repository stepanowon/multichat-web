import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../authStore.js";

export default function Login() {
  const onLogin = useAuth((s) => s.login);
  const [adminPw, setAdminPw] = useState("");
  const [adminErr, setAdminErr] = useState("");

  const [nickname, setNickname] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [studentPw, setStudentPw] = useState("");
  const [studentErr, setStudentErr] = useState("");

  // 백엔드 서버가 안 떠 있으면 fetch 자체가 실패(status 없음) — 원인을 구분해서 보여준다.
  function describeError(e) {
    if (e.status === undefined) return "서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.";
    return null;
  }

  async function submitAdmin() {
    setAdminErr("");
    try {
      const data = await api.loginAdmin(adminPw);
      onLogin(data);
    } catch (e) {
      setAdminErr(describeError(e) || (e.data?.error === "INVALID_PASSWORD" ? "패스워드가 일치하지 않습니다." : "로그인 실패"));
    }
  }

  // 서버 에러 코드(docs/4-api.md 1.2) → 사용자 안내 문구.
  const STUDENT_ERRORS = {
    MISSING_FIELDS: "닉네임, 고유식별자, 패스워드를 모두 입력해주세요.",
    RESERVED_NAME: "'강사'는 닉네임이나 고유식별자로 사용할 수 없습니다.",
    INVALID_PASSWORD: "패스워드가 일치하지 않습니다.",
    IDENTIFIER_TAKEN: "이미 사용 중인 식별자입니다. 다시 입력해주세요.",
  };

  async function submitStudent() {
    setStudentErr("");
    try {
      const data = await api.loginStudent(nickname, identifier, studentPw);
      onLogin(data);
    } catch (e) {
      setStudentErr(describeError(e) || STUDENT_ERRORS[e.data?.error] || "로그인 실패");
    }
  }

  return (
    <div className="hero">
      <span className="badge">MultiChat Web</span>
      <h1>강사·수강생 실시간 메시지 &amp; 파일 공유</h1>
      <div className="login-grid">
        <div className="card login-card">
          <h2>👨‍🏫 강사로 입장</h2>
          <input type="password" placeholder="관리자 패스워드" value={adminPw}
            onChange={(e) => setAdminPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAdmin()} />
          <button className="button" onClick={submitAdmin}>입장하기</button>
          {adminErr && <p className="error-text">{adminErr}</p>}
        </div>

        <div className="card login-card">
          <h2>🧑‍🎓 수강생으로 입장</h2>
          <input placeholder="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          <input placeholder="고유식별자" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <input type="password" placeholder="공통 패스워드" value={studentPw}
            onChange={(e) => setStudentPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitStudent()} />
          <button className="button" onClick={submitStudent}>입장하기</button>
          {studentErr && <p className="error-text">{studentErr}</p>}
        </div>
      </div>
    </div>
  );
}
