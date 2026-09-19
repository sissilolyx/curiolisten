import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import test from "node:test";
import { extractCorrectionHints, buildRecognitionHints } from "../public/transcript-correction-utils.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "listening-correction-test-"));
process.env.LISTENING_DATA_DIR = root;
const storage = await import("../lib/storage.mjs");
const memory = await import("../lib/correction-memory.mjs");
const media = await import("../lib/media.mjs");
test.after(() => fs.rm(root, { recursive: true, force: true }));

test("extracts corrected vocabulary, ignores punctuation, function words and extensive rewrites", () => {
  assert.deepEqual(extractCorrectionHints("A wooden puppet named lumo in rain coats.", "A wooden puppet named Lumo in raincoats."), [
    { before: "lumo", after: "Lumo" }, { before: "rain coats", after: "raincoats" },
  ]);
  assert.deepEqual(extractCorrectionHints("Hello world.", "Hello, world!"), []);
  assert.deepEqual(extractCorrectionHints("The team is creative.", "The team are creative."), []);
  assert.deepEqual(extractCorrectionHints("Please bring the small wooden box to our office today.", "The silver carousel floats above a painted sea beneath two paper moons."), []);
  assert.deepEqual(extractCorrectionHints("We discuss the launch.", "We discuss Lumenland and the launch."), [{ before: "", after: "Lumenland and" }]);
});

test("recognition prompts use recent active target words, deduplicate and stay bounded", () => {
  const corrections = [
    { previousText: "I saw lumo.", correctedText: "I saw Lumo.", enabled: true, createdAt: "2026-01-01" },
    { previousText: "I saw rain coats.", correctedText: "I saw raincoats.", enabled: false, createdAt: "2026-01-03" },
    { previousText: "We saw lumo.", correctedText: "We saw Lumo.", enabled: true, createdAt: "2026-01-02" },
  ];
  assert.deepEqual(buildRecognitionHints(corrections), { prompt: "Lumo", terms: ["Lumo"] });
  assert.deepEqual(buildRecognitionHints(corrections, { maxCharacters: 2 }), { prompt: "", terms: [] });
  assert.deepEqual(buildRecognitionHints(corrections, { maxWords: 0 }), { prompt: "", terms: [] });
});

test("saved corrections are atomic, opt out works, and subsequent edits retire old hints", async () => {
  await storage.ensureStorage();
  const material = await seed("Memory lifecycle");
  const before = material.sentences[0].text;
  const corrected = "A wooden puppet named Lumo in raincoats.";
  const saved = await storage.updateSentenceText(material.id, "sentence-one", corrected, { expectedText: before });
  assert.equal(saved.correction.enabled, true);
  assert.equal(saved.material.sentences[0].start, 1);
  assert.equal(saved.material.sentences[0].speaker, "Synthetic");
  assert.deepEqual(saved.material.progress, material.progress);
  assert.deepEqual(saved.material.reviewItems, material.reviewItems);
  assert.equal((await memory.listCorrectionMemory()).find(item => item.id === saved.correction.id).materialId, material.id);
  const repeated = await storage.updateSentenceText(material.id, "sentence-one", corrected, { expectedText: corrected });
  assert.equal(repeated.changed, false);
  await assert.rejects(storage.updateSentenceText(material.id, "sentence-one", "Conflicting text", { expectedText: before }));
  assert.equal((await storage.readMaterial(material.id)).transcriptCorrections.length, 1);
  await memory.setCorrectionEnabled(material.id, saved.correction.id, false);
  assert.equal((await memory.loadRecognitionHints()).prompt, "");
  await memory.setCorrectionEnabled(material.id, saved.correction.id, true);
  assert.equal((await memory.loadRecognitionHints()).prompt, "Lumo, raincoats");
  const next = await storage.updateSentenceText(material.id, "sentence-one", "A wooden puppet named Lumo in capes.", { expectedText: corrected, learnForRecognition: false });
  assert.equal(next.correction.enabled, false);
  assert.equal((await memory.loadRecognitionHints()).prompt, "");
  assert.equal((await storage.readMaterial(material.id)).transcriptCorrections.length, 2, "history is retained");
});

test("API persists confirmed corrections and subsequent Whisper calls receive only enabled hints", { timeout: 30000 }, async context => {
  const material = await seed("API and recognition");
  const bin = path.join(root, "fake-bin");
  await fs.mkdir(bin);
  const modelPath = path.join(root, "synthetic-model.bin");
  await fs.writeFile(modelPath, Buffer.alloc(1024 * 1024 + 1));
  const argvPath = path.join(root, "whisper-argv.json");
  await fakeCommand(bin, "ffmpeg", "require('node:fs').writeFileSync(process.argv.at(-1), 'synthetic wav');");
  await fakeCommand(bin, "whisper-cli", `const fs = require('node:fs'); const args = process.argv.slice(2); fs.writeFileSync(${JSON.stringify(argvPath)}, JSON.stringify(args)); fs.writeFileSync(args[args.indexOf('-of') + 1] + '.json', JSON.stringify({transcription: [{text:'Synthetic audio.',offsets:{from:0,to:1000}}]}));`);
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}:/usr/bin:/bin`;
  context.after(() => { process.env.PATH = oldPath; });
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, PORT: String(port), SKIP_CODEX_ANALYSIS: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.after(async () => { if (server.exitCode === null) { server.kill(); await once(server, "exit"); } });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server timeout")), 8000);
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.stdout.on("data", chunk => { if (String(chunk).includes("原声精听已启动")) { clearTimeout(timer); resolve(); } });
  });
  const api = async (url, method = "GET", body, expected = 200) => {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(response.status, expected);
    return response.json();
  };
  const endpoint = `/api/materials/${material.id}/sentences/sentence-one`;
  const edit = { expectedText: material.sentences[0].text, text: "A wooden puppet named Lumo in raincoats.", learnForRecognition: true };
  await api(endpoint, "PATCH", { ...edit, learnForRecognition: "yes" }, 400);
  const saved = await api(endpoint, "PATCH", edit);
  const list = await api("/api/correction-memory");
  assert.equal(list.corrections.find(item => item.id === saved.correction.id).enabled, true);
  const stages = [];
  const output = await media.transcribeMedia(path.join(root, "synthetic.mp3"), root, { modelPath, duration: 1, onStage: stage => stages.push(stage) });
  const argv = JSON.parse(await fs.readFile(argvPath));
  assert.equal(argv[argv.indexOf("--prompt") + 1], "Lumo, raincoats");
  assert.ok(argv.includes("--carry-initial-prompt"));
  assert.deepEqual(output.recognitionHints, ["Lumo", "raincoats"]);
  assert.ok(stages.some(stage => stage.includes("参考 2 条纠错")));
  const control = `/api/materials/${material.id}/corrections/${saved.correction.id}`;
  await api(control, "PATCH", { enabled: false });
  await media.transcribeMediaRange(path.join(root, "synthetic.mp3"), root, { modelPath, start: 2, end: 3 });
  assert.ok(!JSON.parse(await fs.readFile(argvPath)).includes("--prompt"), "disabled hints are absent on the very next recognition");
  await api(control, "PATCH", { enabled: true });
  await media.transcribeMediaRange(path.join(root, "synthetic.mp3"), root, { modelPath, start: 2, end: 3 });
  assert.ok(JSON.parse(await fs.readFile(argvPath)).includes("--prompt"), "range repair also receives active hints");
  await api(control, "PATCH", { enabled: false });
  const persisted = JSON.parse(await fs.readFile(path.join(storage.materialDir(material.id), "material.json")));
  assert.equal(persisted.sentences[0].text, edit.text);
  assert.equal(persisted.transcriptCorrections[0].enabled, false);
  await api(control, "PATCH", { enabled: "true" }, 400);
  await api(`/api/materials/${material.id}/corrections/correction-missing`, "PATCH", { enabled: false }, 404);
});

test("data preservation mode prevents expiration cleanup", async () => {
  const directory = path.join(root, "trash", "material-expired");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "trash.json"), JSON.stringify({ id: "material-expired", expiresAt: "2000-01-01" }));
  process.env.LISTENING_PRESERVE_DATA = "1";
  try { assert.deepEqual(await storage.purgeExpiredTrash(), []); await fs.access(directory); }
  finally { delete process.env.LISTENING_PRESERVE_DATA; }
});

async function seed(title) {
  const material = await storage.createMaterial({ title });
  material.status = "ready";
  material.analysisStatus = "ready";
  material.sentences = [{ id: "sentence-one", text: "A wooden puppet named lumo in rain coats.", start: 1, end: 4, speaker: "Synthetic", analysis: { translationZh: "测试", spokenFormNotes: [] } }];
  material.paragraphs = [{ id: "paragraph-one", sentenceIds: ["sentence-one"], start: 1, end: 4, text: material.sentences[0].text }];
  material.progress = { "sentence-one": { dictation: "keep my notes" } };
  material.reviewItems = [{ id: "review-one", kind: "sentence", sentenceId: "sentence-one" }];
  await storage.saveMaterial(material);
  return material;
}

async function fakeCommand(bin, name, code) {
  const file = path.join(bin, name);
  await fs.writeFile(file, `#!${process.execPath}\n${code}\n`);
  await fs.chmod(file, 0o755);
}
