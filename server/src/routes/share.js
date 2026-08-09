import { Router } from "express";
import { requireAuth, requireAdmin } from "../auth.js";
import { shareState, broadcastToAll } from "../state.js";
import { isValidDirectory, listTree, resolveWithinRoot } from "../shareFiles.js";

const router = Router();

router.post("/share/dir", requireAuth, requireAdmin, (req, res) => {
  const { path: dirPath } = req.body || {};
  if (!dirPath || !isValidDirectory(dirPath)) {
    return res.status(400).json({ error: "INVALID_PATH" });
  }
  shareState.root = dirPath;
  broadcastToAll({ type: "share_updated" });
  res.json({ ok: true, path: dirPath });
});

router.get("/share/files", requireAuth, (req, res) => {
  if (!shareState.root) return res.json({ root: null, tree: [] });
  res.json({ root: shareState.root, tree: listTree(shareState.root) });
});

router.get("/share/download", requireAuth, (req, res) => {
  if (!shareState.root) return res.status(404).json({ error: "NOT_FOUND" });
  const abs = resolveWithinRoot(shareState.root, req.query.path || "");
  if (!abs) return res.status(400).json({ error: "INVALID_PATH" });
  res.download(abs);
});

export default router;
