// Shared by the form and API. Always pass a canonical single-video URL to the downloader.
export function normalizeYouTubeUrl(value) {
  const invalid = () => Object.assign(new Error("请粘贴有效的 YouTube 视频链接（支持 youtube.com 和 youtu.be）"), { statusCode: 400 });
  if (typeof value !== "string" || value.length > 2048) throw invalid();
  let text = value.trim();
  if (/^(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\//i.test(text)) text = `https://${text}`;
  let url;
  try { url = new URL(text); } catch { throw invalid(); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) throw invalid();

  let id;
  if (["youtu.be", "www.youtu.be"].includes(url.hostname)) {
    id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(url.hostname)) {
    if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1) id = url.searchParams.get("v");
    else id = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || "")) throw invalid();
  return `https://www.youtube.com/watch?v=${id}`;
}
