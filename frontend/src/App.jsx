import { useAuth } from "./authStore.js";
import Login from "./pages/Login.jsx";
import AdminChat from "./pages/AdminChat.jsx";
import StudentChat from "./pages/StudentChat.jsx";

// 로그인/로그아웃은 authStore에서 일어나고, 여기서는 그 결과로 화면만 고른다.
export default function App() {
  const role = useAuth((s) => s.user?.role);
  if (!role) return <Login />;
  if (role === "admin") return <AdminChat />;
  return <StudentChat />;
}
