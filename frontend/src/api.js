import { getToken, logout } from "./authStore.js";

const authHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 토큰이 만료/무효(서버 재기동으로 시크릿이 바뀐 경우 등)면 화면이 조용히 멈추는 대신 재로그인 화면으로.
    if (res.status === 401 && getToken()) logout();
    throw Object.assign(new Error(data.error || "REQUEST_FAILED"), { data, status: res.status });
  }
  return data;
}

export const api = {
  loginAdmin: (password) => request("POST", "/api/login/admin", { password }),
  loginStudent: (nickname, identifier, password) =>
    request("POST", "/api/login/student", { nickname, identifier, password }),
  setShareDir: (path) => request("POST", "/api/share/dir", { path }),
  getShareFiles: () => request("GET", "/api/share/files"),
  downloadUrl: (relPath) => `/api/share/download?path=${encodeURIComponent(relPath)}&token=${getToken()}`,
  getDates: () => request("GET", "/api/messages/dates"),
  getMessages: (date) => request("GET", `/api/messages?date=${encodeURIComponent(date)}`),
  exportUrl: (date) => `/api/messages/export?date=${encodeURIComponent(date)}&token=${getToken()}`,
  getServerInfo: () => request("GET", "/api/server-info"),
  listSurveys: () => request("GET", "/api/surveys"),
  createSurvey: (survey) => request("POST", "/api/surveys", survey),
  getSurvey: (id) => request("GET", `/api/surveys/${encodeURIComponent(id)}`),
  submitSurvey: (id, answers) => request("POST", `/api/surveys/${encodeURIComponent(id)}/responses`, { answers }),
  setSurveyClosed: (id, closed) => request("PATCH", `/api/surveys/${encodeURIComponent(id)}`, { closed }),
  deleteSurvey: (id) => request("DELETE", `/api/surveys/${encodeURIComponent(id)}`),
  surveyExportUrl: (id) => `/api/surveys/${encodeURIComponent(id)}/export?token=${getToken()}`,
};
