export default function Lightbox({ src, onClose }) {
  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <img className="lightbox-image" src={src} alt="원본 이미지" onClick={(e) => e.stopPropagation()} />
      <button className="lightbox-close" onClick={onClose}>✕</button>
    </div>
  );
}
