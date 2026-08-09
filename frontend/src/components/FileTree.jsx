import { api } from "../api.js";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function Node({ node }) {
  if (node.type === "dir") {
    return (
      <li className="tree-dir">
        📁 {node.name}
        <ul>{node.children.map((c) => <Node key={c.path || c.name} node={c} />)}</ul>
      </li>
    );
  }
  return (
    <li className="tree-file">
      <a href={api.downloadUrl(node.path)}>📄 {node.name} <span className="file-size">({formatSize(node.size)})</span></a>
    </li>
  );
}

export default function FileTree({ tree }) {
  if (tree.length === 0) return <p className="hint-text">공유된 파일이 없습니다.</p>;
  return <ul className="file-tree">{tree.map((n) => <Node key={n.path || n.name} node={n} />)}</ul>;
}
