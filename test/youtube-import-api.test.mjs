import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const APP_ROOT = path.resolve(import.meta.dirname, "..");

for (const source of ["youtube", "podcast"]) {
test(`${source} API imports into the existing listening pipeline and handles failure without real media or AI`, { timeout: 60_000 }, async (context) => {
  const podcast = source === "podcast";
  const mediaExtension = podcast ? "mp3" : "mp4";
  const title = podcast ? "Synthetic podcast episode" : "Synthetic YouTube lesson";
  const expectedId = podcast ? "1000000000001" : "SYNTH_00001";
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "listening-youtube-api-test-"));
  const bin = path.join(root, "bin");
  const data = path.join(root, "data");
  await fs.mkdir(bin);
  const model = path.join(root, "synthetic-model.bin");
  await fs.writeFile(model, Buffer.alloc(1024 * 1024 + 1));
  const modeFile = path.join(root, "mode");
  const record = path.join(root, "calls.jsonl");
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let server;
  context.after(async () => {
    if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.writeFile(modeFile, "ok");
  const install = (name, code) => fs.writeFile(path.join(bin, name), `#!${process.execPath}\n${code}\n`, { mode: 0o755 });
  await install("yt-dlp", `
const fs = require('node:fs');
const mode = fs.readFileSync(${JSON.stringify(modeFile)}, 'utf8');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(record)}, JSON.stringify(args) + '\\n');
if (mode === 'private') { console.error('Private video. Sign in'); process.exit(1); }
if (args.includes('--skip-download')) {
  console.log(JSON.stringify({id: mode === 'mismatch' ? '1234567890' : ${JSON.stringify(expectedId)}, title: ${JSON.stringify(title)}, duration: mode === 'long' ? 14401 : 8, live_status: mode === 'live' ? 'is_live' : 'not_live'}));
} else if (mode !== 'empty') {
  const target = args[args.indexOf('--output') + 1].replace('%(ext)s', ${JSON.stringify(mediaExtension)});
  fs.writeFileSync(target, 'SYNTHETIC MEDIA BYTES');
  console.log(target);
}
`);
  await install("ffprobe", `console.log(JSON.stringify({ format: { duration: '8', size: '21', format_name: ${JSON.stringify(mediaExtension)} }, streams: [
    ${podcast ? "{codec_type: 'video', codec_name: 'mjpeg', width: 3000, height: 3000, disposition: {attached_pic: 1}}," : "{codec_type: 'video', codec_name: 'h264', width: 640, height: 360, disposition: {attached_pic: 0}},"}
    {codec_type: 'audio', codec_name: 'aac', channels: 1, sample_rate: '44100'}]}));`);
  await install("ffmpeg", `require('node:fs').writeFileSync(process.argv.at(-1), 'SYNTHETIC WAV');`);
  await install("whisper-cli", `
const args = process.argv.slice(2);
require('node:fs').writeFileSync(args[args.indexOf('-of') + 1] + '.json', JSON.stringify({transcription: [
  {text: 'This is a synthetic listening lesson.', offsets: {from: 0, to: 6000}}
]}));`);
  server = spawn(process.execPath, ["server.mjs"], {
    cwd: APP_ROOT,
    env: { ...process.env, PORT: String(port), PATH: `${bin}:/usr/bin:/bin`, LISTENING_DATA_DIR: data, WHISPER_MODEL_PATH: model, SKIP_CODEX_ANALYSIS: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Server not ready: ${output}`)), 5000);
    const collect = (chunk) => {
      output += chunk;
      if (output.includes("原声精听已启动")) { clearTimeout(timer); resolve(); }
    };
    server.stdout.on("data", collect);
    server.stderr.on("data", collect);
    server.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
  const request = async (url, body, headers = {}) => {
    const response = await fetch(`${base}${url}`, body === undefined ? {} : {
      method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const submit = (url, headers) => request(`/api/import/${source}`, { url }, headers);
  const canonical = podcast ? "https://podcasts.apple.com/us/podcast/id1234567890?i=1000000000001" : "https://www.youtube.com/watch?v=SYNTH_00001";
  const finish = async (id) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const { body } = await request(`/api/jobs/${id}`);
      if (["completed", "failed"].includes(body.job.status)) return body.job;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    throw new Error("YouTube job did not finish");
  };

  assert.equal((await submit("http://127.0.0.1:3000/")).status, 400);
  assert.equal((await request(`/api/import/${source}`, null)).status, 400);
  assert.equal((await submit(canonical, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await submit(canonical, { "Content-Type": "text/plain" })).status, 415);
  assert.deepEqual(await fs.readdir(path.join(data, "materials")), []);
  await assert.rejects(fs.access(record), /ENOENT/, "invalid links never invoke the downloader");

  const started = await submit(podcast ? `${canonical}&l=zh-Hans-CN` : "https://youtu.be/SYNTH_00001?list=unwanted&si=tracking");
  assert.equal(started.status, 202);
  assert.equal(started.body.material.sourceType, podcast ? "apple-podcasts" : "youtube");
  assert.equal(started.body.material.sourceUrl, canonical);
  assert.equal((await finish(started.body.job.id)).status, "completed");
  const { body: { material } } = await request(`/api/materials/${started.body.material.id}`);
  assert.equal(material.title, title);
  assert.equal(material.status, "ready");
  assert.equal(material.media.file, `source.${mediaExtension}`);
  assert.equal(material.media.kind, podcast ? "audio" : "video");
  assert.equal(material.duration, 8);
  assert.ok(material.sentences.length > 0);
  assert.ok(material.paragraphs.length > 0);
  assert.equal(material.analysisProvider, null);
  const { body: { source: provenance } } = await request(`/api/materials/${material.id}/source`);
  assert.equal(provenance.url, canonical);
  assert.equal(provenance.typeLabel, podcast ? "Apple Podcasts" : "YouTube");
  assert.equal(provenance.localFile.path, await fs.realpath(path.join(data, "materials", material.id, `source.${mediaExtension}`)));
  assert.equal(provenance.localFile.available, true);
  assert.equal((await request(`/api/materials/${material.id}/reveal-source`, {}, { Origin: "https://evil.example" })).status, 403);
  const media = await fetch(`${base}/api/materials/${material.id}/media`, { headers: { Range: "bytes=0-8" } });
  assert.equal(media.status, 206);
  assert.equal(await media.text(), "SYNTHETIC");
  const calls = (await fs.readFile(record, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(calls.length, 2);
  for (const args of calls) {
    assert.equal(args.at(-1), canonical);
    for (const flag of ["--ignore-config", "--no-plugin-dirs", "--no-playlist"]) assert.ok(args.includes(flag));
    assert.ok(!args.some((arg) => /cookies|exec=/.test(arg)));
  }

  if (!podcast) {
    const filename = "本地采访 100% ready.MP4";
    const uploaded = await fetch(`${base}/api/import/file?filename=${encodeURIComponent(filename)}`, {
      method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: "SYNTHETIC UPLOADED MEDIA",
    });
    assert.equal(uploaded.status, 202);
    const upload = await uploaded.json();
    assert.equal(upload.material.media.originalName, filename);
    assert.equal((await finish(upload.job.id)).status, "completed");
    await fetch(`${base}/api/materials/${upload.material.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "重命名的练习" }),
    });
    const { body: { source: local } } = await request(`/api/materials/${upload.material.id}/source`);
    assert.equal(local.title, "重命名的练习");
    assert.equal(local.typeLabel, "本地上传");
    assert.equal(local.url, null);
    assert.equal(local.localFile.originalName, filename, "renaming and processing must retain the upload name");
    assert.equal(await fs.readFile(local.localFile.path, "utf8"), "SYNTHETIC UPLOADED MEDIA");
    await fs.rename(local.localFile.path, `${local.localFile.path}.moved`);
    assert.equal((await request(`/api/materials/${upload.material.id}/source`)).body.source.localFile.available, false);
    assert.equal((await request(`/api/materials/${upload.material.id}/reveal-source`, {})).status, 404);
  }

  for (const [mode, message] of [["private", podcast ? /公开/ : /登录/], podcast ? ["mismatch", /匹配/] : ["live", /直播/], ["long", /4 小时/], ["empty", /完整/]]) {
    await fs.writeFile(modeFile, mode);
    const failed = await submit(canonical);
    assert.equal(failed.status, 202);
    const job = await finish(failed.body.job.id);
    assert.equal(job.status, "failed", mode);
    assert.match(job.error, message);
    const failedMaterial = await request(`/api/materials/${failed.body.material.id}`);
    assert.equal(failedMaterial.body.material.status, "failed");
  }
  const previousCount = (await fs.readdir(path.join(data, "materials"))).length;
  await fs.rename(path.join(bin, "yt-dlp"), path.join(bin, "yt-dlp-disabled"));
  assert.equal((await submit(canonical)).status, 503);
  assert.equal((await fs.readdir(path.join(data, "materials"))).length, previousCount);
});
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
