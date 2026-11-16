import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

// 설문 목록 + 변경 버전 카운터. 페이지의 WS 핸들러가 survey_updated를 받으면 refresh()를 부르고,
// 열려 있는 설문 상세는 version이 바뀔 때 재조회한다(다른 수강생 응답이 실시간으로 결과에 반영).
export function useSurveys() {
  const [surveys, setSurveys] = useState([]);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    api.listSurveys().then((d) => setSurveys(d.surveys)).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { surveys, version, refresh };
}
