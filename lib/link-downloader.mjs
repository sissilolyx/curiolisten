import fs from "node:fs/promises";
import path from "node:path";
import { commandExists } from "./commands.mjs";
import { MAX_UPLOAD_BYTES } from "./config.mjs";

export async function requireLinkDownloader(label) {
  const binary = await commandExists("yt-dlp");
  if (!binary) throw Object.assign(new Error(`${label} 导入组件尚未安装，请让安装代理按 README 准备 yt-dlp。飞书和本地文件仍可使用。`), { statusCode: 503 });
  return binary;
}

export function linkDownloaderArgs() {
  // Ignore personal configuration, plugins, credentials and playlist behavior.
  return [
    "--ignore-config", "--no-plugin-dirs", "--no-playlist", "--no-cache-dir",
    "--no-colors", "--no-progress", "--socket-timeout", "20",
    "--retries", "2", "--extractor-retries", "2", "--fragment-retries", "2",
    "--js-runtimes", `node:${process.execPath}`,
  ];
}

export async function validateDownloadedFile(stdout, directory, label) {
  const filePath = path.resolve(stdout.trim().split(/\r?\n/).at(-1) || ".");
  if (path.dirname(filePath) !== path.resolve(directory) || !/^source\.[a-z0-9]+$/.test(path.basename(filePath))) {
    throw new Error(`没有取得完整的 ${label} 媒体文件，请重试或选择较短的内容。`);
  }
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${label} 媒体文件为空或超过 4 GB，请选择较短的内容。`);
  }
  return filePath;
}
