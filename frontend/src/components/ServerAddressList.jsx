import { useEffect, useState } from "react";
import { api } from "../api.js";
import { copyText } from "../clipboard.js";

// 강사 사이드바: 수강생이 브라우저에 입력할 서버 접속 주소(LAN IP) 목록 + 복사 버튼.
export default function ServerAddressList() {
  const [info, setInfo] = useState(null); // null = 조회 중

  useEffect(() => {
    api.getServerInfo().then(setInfo).catch(() => setInfo({ port: "", addresses: [], protocol: "http" }));
  }, []);

  if (!info?.addresses.length) {
    return <p className="hint-text">{info ? "접속 가능한 주소를 찾지 못했습니다." : "주소 확인 중..."}</p>;
  }

  return (
    <ul className="server-addr-list">
      {info.addresses.map((ip) => {
        const url = `${info.protocol}://${ip}:${info.port}`;
        return (
          <li key={ip}>
            <code>{url}</code>
            <button className="copy-btn" title="복사" onClick={() => copyText(url)}>⧉</button>
          </li>
        );
      })}
    </ul>
  );
}
