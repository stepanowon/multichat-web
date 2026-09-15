import { useLayoutEffect, useRef, useState } from "react";

export default function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: y, left: x, visibility: "hidden" });

  // 실제 렌더 크기를 잰 뒤 화면 밖으로 나가면 반대 방향으로 붙인다(뷰포트 오른쪽/아래 끝에서 잘림 방지).
  useLayoutEffect(() => {
    const rect = menuRef.current.getBoundingClientRect();
    const left = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 4 : x;
    const top = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 4 : y;
    setPos({ top: Math.max(4, top), left: Math.max(4, left), visibility: "visible" });
  }, [x, y]);

  return (
    <>
      <div className="context-menu-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="context-menu" ref={menuRef} style={pos}>
        {items.map((item) => (
          <button
            key={item.label}
            className={item.danger ? "danger" : ""}
            onClick={() => { item.onClick(); onClose(); }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
