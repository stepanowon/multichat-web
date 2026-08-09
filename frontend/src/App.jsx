import { useState } from "react";
import Login from "./pages/Login.jsx";
import AdminChat from "./pages/AdminChat.jsx";
import StudentChat from "./pages/StudentChat.jsx";

function loadUser() {
  const token = sessionStorage.getItem("token");
  if (!token) return null;
  return {
    token,
    role: sessionStorage.getItem("role"),
    nickname: sessionStorage.getItem("nickname"),
    identifier: sessionStorage.getItem("identifier"),
  };
}

export default function App() {
  const [user, setUser] = useState(loadUser());

  function handleLogin(data) {
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("role", data.role);
    sessionStorage.setItem("nickname", data.nickname);
    sessionStorage.setItem("identifier", data.identifier);
    setUser(data);
  }

  function handleLogout() {
    sessionStorage.clear();
    setUser(null);
  }

  if (!user) return <Login onLogin={handleLogin} />;
  if (user.role === "admin") return <AdminChat user={user} onLogout={handleLogout} />;
  return <StudentChat user={user} onLogout={handleLogout} />;
}
