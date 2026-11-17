import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// 로그인 정보 전역 store — 앱에서 유일한 전역 상태.
// - 읽는 곳: App(화면 선택), api.js·ws.js(토큰), 화면 곳곳(내 식별자·강사 여부).
// - 로그아웃이 일어나는 곳: 나가기 버튼, REST 401, WS 4401(토큰 무효)·4403(강제 종료), 끊긴 소켓으로 전송.
//   모두 logout() 하나로 처리하고, App이 로그인 화면으로 바꾸면 채팅 화면이 언마운트되면서
//   WS 연결과 화면 상태(메시지·설문 등)도 함께 정리된다.
// 컴포넌트 밖(api.js, ws.js)에서는 useAuth.getState()로 읽고 호출한다.
//
// 저장소는 sessionStorage(탭 단위): 한 브라우저에서 강사 탭·수강생 탭을 따로 띄울 수 있고,
// 탭을 닫으면 로그인도 사라진다. 채팅 메시지·설문 등 화면 상태는 여기 두지 않는다(docs/2-stack.md).
export const useAuth = create(
  persist(
    (set) => ({
      user: null, // { token, role: "admin" | "student", nickname, identifier }
      login: ({ token, role, nickname, identifier }) => set({ user: { token, role, nickname, identifier } }),
      logout: () => set({ user: null }),
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ user: s.user }),
    }
  )
);

export const getToken = () => useAuth.getState().user?.token ?? "";
export const logout = () => useAuth.getState().logout();

// 로그아웃 직후 언마운트되기 전 렌더에서도 깨지지 않도록 user가 null일 수 있다고 보고 읽는다.
export const useIsAdmin = () => useAuth((s) => s.user?.role === "admin");
export const useMyIdentifier = () => useAuth((s) => s.user?.identifier);
