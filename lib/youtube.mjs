import path from "node:path";
import { runCommand } from "./commands.mjs";
import { MAX_UPLOAD_BYTES } from "./config.mjs";
import { normalizeYouTubeUrl } from "../public/youtube-url-utils.js";
import { linkDownloaderArgs, requireLinkDownloader, validateDownloadedFile } from "./link-downloader.mjs";

export async function requireYouTubeDownloader() {
  return requireLinkDownloader("YouTube");
}

export function youtubeImportError(error) {
  const detail = `${error?.result?.stderr || ""}\n${error?.message || error}`;
  if (/private video|sign in|log in|confirm your age|age.restricted|members.only|not a bot|cookies/i.test(detail)) {
    return "YouTube 要求登录或验证，暂时无法直接导入这条视频。可以下载你有权使用的文件后，通过“本地文件”导入。";
  }
  if (/unavailable|not available|removed|copyright|geo.restricted|blocked/i.test(detail)) {
    return "这条 YouTube 视频不可用，可能已下架或存在地区限制。请确认链接后换一条公开视频。";
  }
  if (/403|429|timed? out|timeout|connection|network|resolve|urlopen|remote end/i.test(detail)) {
    return "暂时无法从 YouTube 下载，请检查这台 Mac 的网络连接后重试。若持续失败，请更新 yt-dlp。";
  }
  if (error?.result) return "YouTube 下载失败，请稍后重试或更新 yt-dlp，再试一条可公开访问的视频。";
  return error?.message || "YouTube 导入失败";
}

export async function downloadYouTubeMedia(sourceUrl, directory, options = {}) {
  const url = normalizeYouTubeUrl(sourceUrl);
  const binary = await requireYouTubeDownloader();
  const report = options.onStage || (async () => {});
  const common = linkDownloaderArgs();
  try {
    await report("正在读取 YouTube 视频信息", 0.06);
    const info = await runCommand(binary, [
      ...common, "--skip-download", "--print", "%(.{id,title,duration,live_status})j", "--", url,
    ], { cwd: directory, timeoutMs: 90_000 });
    const metadata = JSON.parse(info.stdout.trim());
    if (["is_live", "is_upcoming", "post_live"].includes(metadata.live_status)) {
      throw new Error("这条视频正在直播或尚未生成回放，请在直播结束、回放可用后导入。");
    }
    if (!Number.isFinite(metadata.duration) || metadata.duration <= 0 || metadata.duration > 4 * 60 * 60) {
      throw new Error("请使用时长在 4 小时以内、已发布的单个 YouTube 视频。");
    }
    await report("正在下载 YouTube 原声视频（最长 720p）", 0.12);
    const downloaded = await runCommand(binary, [
      ...common,
      "--no-simulate", "--no-overwrites", "--max-filesize", String(MAX_UPLOAD_BYTES),
      // H.264/AAC plays in both Safari and Chromium. Fall back to original audio.
      "--format", "bv[height<=720][vcodec^=avc1]+ba[ext=m4a]/b[height<=720][vcodec^=avc1]/ba[ext=m4a]/ba",
      "--merge-output-format", "mp4",
      "--output", path.join(directory, "source.%(ext)s"),
      "--print", "after_move:filepath", "--", url,
    ], { cwd: directory, timeoutMs: 2 * 60 * 60 * 1000 });
    let filePath = await validateDownloadedFile(downloaded.stdout, directory, "YouTube");
    if (![".mp4", ".m4a"].includes(path.extname(filePath))) {
      await report("正在准备可播放的原声音轨", 0.3);
      const audioPath = path.join(directory, "source.m4a");
      await runCommand("ffmpeg", ["-n", "-v", "error", "-i", filePath, "-vn", "-c:a", "aac", "-b:a", "160k", audioPath], {
        cwd: directory, timeoutMs: 30 * 60 * 1000,
      });
      filePath = audioPath;
    }
    return {
      title: String(metadata.title || "YouTube 视频").slice(0, 300),
      sourceUrl: url,
      file: path.basename(filePath),
      audioOnly: path.extname(filePath) === ".m4a",
    };
  } catch (error) {
    throw new Error(youtubeImportError(error));
  }
}
