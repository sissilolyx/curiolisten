export function normalizeApplePodcastsUrl(value) {
  const invalid = (message = "请粘贴有效的 Apple Podcasts 单集链接（podcasts.apple.com）") => Object.assign(new Error(message), { statusCode: 400 });
  if (typeof value !== "string" || value.length > 2048) throw invalid();
  let text = value.trim();
  if (/^podcasts\.apple\.com\//i.test(text)) text = `https://${text}`;
  let url;
  try { url = new URL(text); } catch { throw invalid(); }
  if (!["https:", "http:"].includes(url.protocol) || url.hostname !== "podcasts.apple.com"
    || url.username || url.password || url.port
    || !/^\/(?:[a-z]{2}\/)?podcast\/(?:[^/]+\/)?id[1-9]\d{3,19}\/?$/i.test(url.pathname)) throw invalid();
  const ids = url.searchParams.getAll("i");
  if (!ids.length) throw invalid("这是节目主页，请打开想精听的那一集，复制“分享单集”的链接。");
  if (ids.length !== 1 || !/^[1-9]\d{3,19}$/.test(ids[0])) throw invalid();
  return `https://podcasts.apple.com${url.pathname}?i=${ids[0]}`;
}
