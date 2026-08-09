export default function ContextMenu({ x, y, items, onClose }) {
  return (
    <>
      <div className="context-menu-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="context-menu" style={{ top: y, left: x }}>
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
