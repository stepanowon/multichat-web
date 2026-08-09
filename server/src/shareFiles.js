import fs from "node:fs";
import path from "node:path";

export function isValidDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function buildTree(absDir, relDir) {
  return fs
    .readdirSync(absDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return {
          type: "dir",
          name: entry.name,
          children: buildTree(path.join(absDir, entry.name), relPath),
        };
      }
      const size = fs.statSync(path.join(absDir, entry.name)).size;
      return { type: "file", name: entry.name, path: relPath, size };
    });
}

export function listTree(root) {
  return buildTree(root, "");
}

// 지정 루트 하위 경로인지 검증(경로 탈출 차단), 통과 시 절대경로 반환, 아니면 null.
export function resolveWithinRoot(root, relativePath) {
  const abs = path.resolve(root, relativePath);
  const rootResolved = path.resolve(root);
  if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}
