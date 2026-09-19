import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("legacy sentence API merges on read, preserves originals on save, and supports review, edits and reload", { timeout: 20000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "listening-sentence-api-"));
  const directory = path.join(root, "materials/material-legacy");
  await fs.mkdir(directory, { recursive: true });
  const source = {
    id: "material-legacy", title: "Synthetic legacy sentence", sourceType: "youtube", status: "ready", analysisStatus: "ready",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), duration: 8, media: { file: "source.mp4", kind: "video" },
    sentences: [
      { id: "sentence-1", speaker: "Speaker", start: 0, end: 5, text: "This is a painted lantern", timingQuality: "source", analysis: { translationZh: "前半句", explanationZh: "已有讲解一", phrases: [], spokenFormNotes: [] } },
      { id: "sentence-2", speaker: "Speaker", start: 5, end: 8, text: "that glows softly by the castle.", timingQuality: "source", analysis: { translationZh: "后半句", explanationZh: "已有讲解二", phrases: [], spokenFormNotes: [] } },
    ],
    paragraphs: [{ id: "paragraph-1", sentenceIds: ["sentence-1", "sentence-2"], start: 0, end: 8 }],
    progress: { "sentence-1": { heard: true }, "sentence-2": { heard: true } },
    reviewItems: [{ id: "review-existing", kind: "phrase", sentenceId: "sentence-2", sourceText: "glows softly", meaningZh: "柔和发光", usageZh: "原记录" }],
    qaHistory: [{ id: "question-existing", sentenceId: "sentence-2", question: "原问题", answerZh: "原回答" }],
  };
  await fs.writeFile(path.join(directory, "material.json"), JSON.stringify(source));
  await fs.writeFile(path.join(directory, "source.mp4"), "SYNTHETIC MEDIA");
  const probe = net.createServer().listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, LISTENING_DATA_DIR: root, SKIP_CODEX_ANALYSIS: "1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
    await fs.rm(root, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timed out")), 5000);
    server.stdout.on("data", output => {
      if (String(output).includes("原声精听已启动")) { clearTimeout(timer); resolve(); }
    });
    server.once("error", reject);
  });
  const base = `http://127.0.0.1:${port}`;
  const api = async (suffix, method = "GET", body) => {
    const response = await fetch(`${base}${suffix}`, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    return { status: response.status, payload: await response.json() };
  };
  const route = "/api/materials/material-legacy";
  const { payload: { material } } = await api(route);
  assert.equal(material.sentences.length, 1);
  assert.equal(material.sentences[0].text, "This is a painted lantern that glows softly by the castle.");
  assert.equal(material.reviewItems[0].sentenceId, "sentence-1");
  assert.equal(material.qaHistory[0].answerZh, "原回答");
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, "material.json"), "utf8")), source, "GET must not rewrite the source file");
  const review = await api(`${route}/review-items`, "POST", { kind: "phrase", sentenceId: "sentence-2", sourceText: "glows softly", meaningZh: "柔和发光", usageZh: "合并后保存" });
  assert.equal(review.status, 200);
  assert.equal(review.payload.reviewItem.sentenceId, "sentence-1", "old sentence IDs still resolve safely");
  const queue = await api("/api/review-queue");
  assert.equal(queue.payload.items[0].sentenceIds.length, 1);
  const saved = JSON.parse(await fs.readFile(path.join(directory, "material.json"), "utf8"));
  assert.deepEqual(saved.sentenceBoundaryHistory[0].sentences, source.sentences);
  assert.equal(saved.reviewItems.length, 2);
  assert.equal(saved.qaHistory.length, 1);
  assert.equal(saved.sentences[0].analysis.spokenFormNotes.length, 0);
  assert.equal((await fs.readdir(path.join(root, "jobs"))).length, 0, "merging completed explanations must not start an AI job");
  assert.equal((await api(`${route}/sentences/sentence-2`, "PATCH", { text: "A stale edit.", expectedText: source.sentences[1].text })).status, 409);
  const newText = "This is a tiny lantern that glows softly by the castle.";
  const edited = await api(`${route}/sentences/sentence-1`, "PATCH", { text: newText, expectedText: material.sentences[0].text, learnForRecognition: false });
  assert.equal(edited.status, 200);
  const reloaded = (await api(route)).payload.material;
  assert.equal(reloaded.sentences[0].text, newText);
  assert.equal(reloaded.sentences[0].start, 0);
  assert.equal(reloaded.sentences[0].end, 8);
  assert.equal(reloaded.reviewItems.length, 2);
  assert.equal(await fs.readFile(path.join(directory, "source.mp4"), "utf8"), "SYNTHETIC MEDIA");
});
