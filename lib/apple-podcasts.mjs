import path from "node:path";
import { runCommand } from "./commands.mjs";
import { MAX_UPLOAD_BYTES } from "./config.mjs";
import { linkDownloaderArgs, requireLinkDownloader, validateDownloadedFile } from "./link-downloader.mjs";
import { normalizeApplePodcastsUrl } from "../public/apple-podcasts-url-utils.js";

export function applePodcastsImportError(error) {
  const detail = `${error?.result?.stderr || ""}\n${error?.message || error}`;
  if (/sign in|log in|subscription|subscriber|premium|no video formats|no audio|unable to extract|unsupported url|404|not found|unavailable|not available/i.test(detail)) {
    return "未找到这集可公开下载的原声，可能是订阅专享或已下架。请换一集公开节目，或导入你有权使用的本地音频。";
  }
  if (/403|429|timeout|timed? out|connection|network|resolve|urlopen|remote end/i.test(detail)) {
    return "暂时无法下载这集播客，请检查网络后重试；持续失败时请更新 yt-dlp。";
  }
  if (error?.result) return "Apple Podcasts 下载失败，请确认单集可公开播放后重试。";
  return error?.message || "Apple Podcasts 导入失败";
}

export async function downloadApplePodcast(sourceUrl, directory, options = {}) {
  const url = normalizeApplePodcastsUrl(sourceUrl);
  const binary = await requireLinkDownloader("Apple Podcasts");
  const report = options.onStage || (async () => {});
  const common = linkDownloaderArgs();
  try {
    await report("正在读取 Apple Podcasts 单集信息", 0.06);
    const info = await runCommand(binary, [
      ...common, "--skip-download", "--print", "%(.{id,title,duration})j", "--", url,
    ], { cwd: directory, timeoutMs: 90_000 });
    const metadata = JSON.parse(info.stdout.trim());
    if (String(metadata.id) !== new URL(url).searchParams.get("i")) {
      throw new Error("未能匹配链接指定的播客单集，请重新复制“分享单集”链接。");
    }
    if (!Number.isFinite(metadata.duration) || metadata.duration <= 0 || metadata.duration > 4 * 60 * 60) {
      throw new Error("请使用时长在 4 小时以内、已发布的播客单集。");
    }
    await report("正在下载播客原声音频", 0.12);
    const downloaded = await runCommand(binary, [
      ...common, "--no-simulate", "--no-overwrites", "--max-filesize", String(MAX_UPLOAD_BYTES),
      "--format", "bestaudio/best", "--output", path.join(directory, "source.%(ext)s"),
      "--print", "after_move:filepath", "--", url,
    ], { cwd: directory, timeoutMs: 2 * 60 * 60 * 1000 });
    let filePath = await validateDownloadedFile(downloaded.stdout, directory, "Apple Podcasts");
    if (![".mp3", ".m4a", ".wav", ".mp4"].includes(path.extname(filePath))) {
      await report("正在准备可播放的播客音轨", 0.3);
      const audioPath = path.join(directory, "source.m4a");
      await runCommand("ffmpeg", ["-n", "-v", "error", "-i", filePath, "-vn", "-c:a", "aac", "-b:a", "160k", audioPath], {
        cwd: directory, timeoutMs: 30 * 60 * 1000,
      });
      filePath = audioPath;
    }
    return { title: String(metadata.title || "Apple Podcasts 单集").slice(0, 300), sourceUrl: url, file: path.basename(filePath) };
  } catch (error) {
    throw new Error(applePodcastsImportError(error));
  }
}
