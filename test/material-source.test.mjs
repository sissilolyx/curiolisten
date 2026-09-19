import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("material source keeps provenance and reveals only the material's own existing media", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "listening-source-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  process.env.LISTENING_DATA_DIR = path.join(root, "data");
  const { getMaterialSource, originalUploadName, originalSourceUrl, revealMaterialSource } = await import("../lib/material-source.mjs");
  const { createMaterial, ensureStorage, materialDir } = await import("../lib/storage.mjs");
  await ensureStorage();

  assert.equal(originalUploadName("采访 100% ready.MP4"), "采访 100% ready.MP4");
  assert.equal(originalUploadName("C:\\fakepath\\声音 %20.wav"), "声音 %20.wav");
  assert.equal(originalUploadName("../../recording.mp3"), "recording.mp3");
  assert.equal(originalSourceUrl("javascript:alert(1)"), null);
  assert.equal(originalSourceUrl("file:///etc/hosts"), null);
  assert.equal(originalSourceUrl("https://user:password@example.com"), null);

  const url = "https://www.youtube.com/watch?v=SYNTH_00001";
  const material = await createMaterial({ title: "Renamed listening lesson", sourceType: "youtube", sourceUrl: url });
  const file = path.join(materialDir(material.id), "source.mp4");
  await fs.writeFile(file, "synthetic source media");
  material.media = { file: "source.mp4" };
  const source = await getMaterialSource(material);
  assert.equal(source.url, url);
  assert.equal(source.typeLabel, "YouTube");
  assert.equal(source.localFile.originalName, null, "legacy materials must not invent an original name");
  assert.equal(source.localFile.path, await fs.realpath(file));
  assert.equal(source.localFile.available, true);

  const calls = [];
  const run = async (...args) => calls.push(args);
  assert.deepEqual(await revealMaterialSource(material, { run, platform: "darwin" }), { revealed: true });
  assert.deepEqual(calls, [["/usr/bin/open", ["-R", source.localFile.path], { timeoutMs: 10000 }]]);
  await assert.rejects(revealMaterialSource(material, { run, platform: "linux" }), { statusCode: 400 });

  const outside = path.join(root, "unrelated.mp4");
  await fs.writeFile(outside, "unrelated media");
  await fs.symlink(outside, path.join(materialDir(material.id), "escape.mp4"));
  for (const invalid of [outside, "../../../unrelated.mp4", "escape.mp4", "missing.mp4", "."]) {
    material.media.file = invalid;
    const missing = await getMaterialSource(material);
    assert.equal(missing.localFile.path, null, invalid);
    assert.equal(missing.localFile.available, false, invalid);
    assert.equal(missing.url, url, "missing media must not hide the source page");
    await assert.rejects(revealMaterialSource(material, { run, platform: "darwin" }), { statusCode: 404 });
  }
  assert.equal(calls.length, 1, "invalid paths must never launch Finder");

  material.sourceType = "local";
  material.sourceUrl = null;
  material.media = { file: "source.mp4", originalName: "采访 100% ready.MP4" };
  const uploaded = await getMaterialSource(material);
  assert.equal(uploaded.url, null);
  assert.equal(uploaded.typeLabel, "本地上传");
  assert.equal(uploaded.localFile.originalName, "采访 100% ready.MP4");
  await assert.rejects(revealMaterialSource(material, { run: async () => { throw new Error("open failed"); }, platform: "darwin" }), { statusCode: 500 });
});
