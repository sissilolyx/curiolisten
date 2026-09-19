import assert from "node:assert/strict";
import test from "node:test";
import { normalizeYouTubeUrl } from "../public/youtube-url-utils.js";
import { youtubeImportError } from "../lib/youtube.mjs";

const canonical = "https://www.youtube.com/watch?v=SYNTH_00001";

test("YouTube links resolve to one video and discard tracking, timestamps and playlists", () => {
  for (const value of [canonical, `${canonical}&list=PLanything&t=42`,
    "https://youtu.be/SYNTH_00001?si=sharing", "youtu.be/SYNTH_00001",
    "https://www.youtube.com/shorts/SYNTH_00001", "https://m.youtube.com/watch?v=SYNTH_00001",
    "https://www.youtube.com/live/SYNTH_00001", "https://www.youtube.com/embed/SYNTH_00001",
  ]) assert.equal(normalizeYouTubeUrl(value), canonical);
});

test("YouTube URL validation rejects arbitrary hosts, credential URLs and non-video requests", () => {
  for (const value of [null, {}, [], "", "--exec=anything", "file:///etc/passwd", "http://127.0.0.1:3000/",
    "https://youtube.com.evil.example/watch?v=SYNTH_00001", "https://youtube.com@evil.example/watch?v=SYNTH_00001",
    "https://user:password@youtube.com/watch?v=SYNTH_00001", "https://youtube.com:8080/watch?v=SYNTH_00001",
    "https://youtube.com/playlist?list=anything", "https://youtube.com/@channel", `${canonical}&v=other`,
    "https://youtu.be/SYNTH_00001/extra", "https://youtube.com/watch?v=invalid", "a".repeat(2049),
  ]) assert.throws(() => normalizeYouTubeUrl(value), { statusCode: 400 });
});

test("YouTube errors describe recovery without exposing signed URLs or authentication instructions", () => {
  const fail = (stderr) => youtubeImportError({ result: { stderr } });
  assert.match(fail("Sign in to confirm you're not a bot. Use --cookies-from-browser."), /本地文件/);
  assert.match(fail("This video is not available in your country"), /地区限制/);
  assert.match(fail("HTTP Error 403: https://signed.example/private?signature=secret"), /网络/);
  assert.doesNotMatch(fail("Unexpected https://signed.example/private?signature=secret"), /secret|signed/);
});
