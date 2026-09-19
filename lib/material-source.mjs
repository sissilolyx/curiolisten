import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./commands.mjs";
import { materialDir } from "./storage.mjs";

const sourceLabels = { youtube: "YouTube", "apple-podcasts": "Apple Podcasts", lark: "飞书妙记", local: "本地上传" };

export function originalUploadName(value) {
  // URLSearchParams already decoded the filename, including literal percent signs.
  return path.basename(String(value || "meeting-audio").replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f]/g, "");
}

export function originalSourceUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export async function resolveSourceFile(material) {
  const file = material.media?.file;
  if (typeof file !== "string" || !file || path.isAbsolute(file)) return null;
  const directory = materialDir(material.id);
  const candidate = path.resolve(directory, file);
  if (!candidate.startsWith(`${directory}${path.sep}`)) return null;
  try {
    const [root, resolved] = await Promise.all([fs.realpath(directory), fs.realpath(candidate)]);
    if (!resolved.startsWith(`${root}${path.sep}`) || !(await fs.stat(resolved)).isFile()) return null;
    return resolved;
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(error.code)) return null;
    throw error;
  }
}

export async function getMaterialSource(material) {
  const filePath = await resolveSourceFile(material);
  return {
    materialId: material.id,
    title: material.title,
    typeLabel: sourceLabels[material.sourceType] || "导入材料",
    url: originalSourceUrl(material.sourceUrl),
    localFile: {
      originalName: material.media?.originalName || null,
      savedName: filePath ? path.basename(filePath) : null,
      path: filePath,
      available: Boolean(filePath),
      canReveal: Boolean(filePath) && process.platform === "darwin",
    },
  };
}

export async function revealMaterialSource(material, { run = runCommand, platform = process.platform } = {}) {
  const filePath = await resolveSourceFile(material);
  if (!filePath) throw Object.assign(new Error("找不到这份材料保存的音视频文件"), { statusCode: 404 });
  if (platform !== "darwin") throw Object.assign(new Error("在访达中显示仅支持 macOS"), { statusCode: 400 });
  try {
    await run("/usr/bin/open", ["-R", filePath], { timeoutMs: 10_000 });
  } catch {
    throw Object.assign(new Error("暂时无法打开访达，可以复制下方的保存位置"), { statusCode: 500 });
  }
  return { revealed: true };
}
