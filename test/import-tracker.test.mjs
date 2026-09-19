import assert from "node:assert/strict";
import test from "node:test";
import { ImportTracker } from "../public/import-tracker.js";

const job = (id, status = "running", progress = 0.52) => ({
  id: `job-${id}`, materialId: `material-${id}`, status, progress, stage: `Stage ${id}`,
});
const material = (id, status = "processing", extra = {}) => ({
  id: `material-${id}`, title: `Lesson ${id}`, status, analysisStatus: "pending",
  sentenceCount: status === "ready" ? 10 : 0, ...extra,
});

test("imports complete out of order and failures do not stop another material", () => {
  const tracker = new ImportTracker();
  tracker.track(job("one"), material("one"));
  tracker.track(job("two"), material("two"));
  tracker.track(job("three"), material("three"));
  tracker.updateJob(job("two", "completed", 1));
  tracker.updateJob({ ...job("three", "failed"), error: "Download failed" });
  tracker.updateJob(job("one", "running", 0.67));
  tracker.syncMaterials([material("one"), material("two", "ready"), material("three", "failed")]);
  assert.deepEqual(tracker.active.map((entry) => entry.materialId), ["material-one"]);
  assert.equal(tracker.entries.get("material-one").progress, 0.67);
  assert.equal(tracker.entries.get("material-two").canOpen, true);
  assert.equal(tracker.entries.get("material-three").error, "Download failed");
});

test("refresh restores every active job using IDs only, without keeping media or URLs", () => {
  let saved = "[]";
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const before = new ImportTracker(storage);
  before.track(job("one"), { ...material("one"), sourceUrl: "private-url" });
  before.track(job("two"), material("two"));
  before.updateJob(job("two", "completed", 1));
  assert.deepEqual(JSON.parse(saved), [{ jobId: "job-one", materialId: "material-one" }]);
  const after = new ImportTracker(storage);
  after.syncMaterials([material("one")]);
  assert.equal(after.active.length, 1);
  assert.equal(after.active[0].title, "Lesson one");
  assert.equal(after.active[0].jobId, "job-one");
});

test("already running materials recover without a job ID or fabricated progress", () => {
  const tracker = new ImportTracker();
  tracker.syncMaterials([
    material("old", "processing", { stage: "Whisper is transcribing" }),
    material("analysis", "ready", { analysisStatus: "processing" }),
    material("done", "ready"),
  ]);
  assert.equal(tracker.active.length, 2);
  assert.equal(tracker.entries.get("material-old").progress, null);
  assert.equal(tracker.entries.get("material-analysis").canOpen, true);
  tracker.syncMaterials([material("old", "ready"), material("analysis", "ready", { analysisStatus: "ready" })]);
  assert.equal(tracker.active.length, 0);
  assert.equal(tracker.entries.get("material-old").canOpen, true);
});

test("transient job errors preserve tracking and missing records fall back to material status", () => {
  const tracker = new ImportTracker();
  tracker.track(job("one"), material("one"));
  tracker.jobUnavailable("job-one", new Error("Network offline"));
  assert.equal(tracker.active[0].jobId, "job-one");
  assert.match(tracker.active[0].connectionError, /重试/);
  tracker.updateJob(job("one", "running", 0.72));
  assert.equal(tracker.active[0].connectionError, "");
  tracker.jobUnavailable("job-one", { status: 404 });
  tracker.syncMaterials([material("one", "failed", { error: "Interrupted" })]);
  assert.equal(tracker.active.length, 0);
  assert.equal(tracker.entries.get("material-one").error, "Interrupted");
});

test("late responses and older library snapshots never replace another import", () => {
  const tracker = new ImportTracker();
  tracker.track(job("one"), material("one"));
  tracker.track(job("two"), material("two"));
  tracker.syncMaterials([material("one")]);
  assert.equal(tracker.active.length, 2, "newly accepted job survives a stale library response");
  tracker.remove("material-one");
  tracker.updateJob(job("one", "completed", 1));
  assert.deepEqual(tracker.active.map((entry) => entry.jobId), ["job-two"]);
  assert.equal(tracker.entries.has("material-one"), false);
});

test("unavailable or malformed browser storage never prevents importing", () => {
  for (const storage of [
    { getItem: () => "not-json" },
    { getItem: () => '{"jobId":"job-one"}' },
    { getItem: () => '[null,{"jobId":"../bad","materialId":"material-one"}]' },
    { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); } },
  ]) {
    const tracker = new ImportTracker(storage);
    tracker.track(job("one"), material("one"));
    assert.equal(tracker.active.length, 1);
  }
});
