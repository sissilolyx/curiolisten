import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { StudyClock, formatStudyTime } from "../public/study-clock.js";
import { createStudyTimeStore, mergeStudyIntervals, summarizeStudyTime, validateStudyIntervals } from "../lib/study-time.mjs";

const base = Date.parse("2026-09-17T15:59:30Z");
const span = (start, end, mode = "intensive", kind = "interaction", activityAt = start) => ({ start, end, mode, kind, activityAt });
function session() {
  const clock = new StudyClock();
  const intervals = [];
  let sample = { now: base, monotonic: 0, mode: "intensive", mediaKey: "audio", position: 0, rate: 1, playing: false, seeking: false, speaking: false };
  const tick = (ms, overrides = {}, interaction = false) => {
    sample = { ...sample, now: sample.now + ms, monotonic: sample.monotonic + ms, ...overrides };
    intervals.push(...clock.pulse(sample, interaction));
  };
  const totals = () => summarizeStudyTime(mergeStudyIntervals(intervals), { now: base + 3600_000 }).totals;
  return { clock, tick, totals, intervals };
}

test("opening alone earns nothing; interaction starts a one-minute idle window and resumes without backfill", () => {
  const s = session();
  for (let i = 0; i < 90; i++) s.tick(1000);
  assert.equal(s.totals().totalMs, 0);
  s.tick(0, {}, true);
  for (let i = 0; i < 70; i++) s.tick(1000);
  assert.equal(s.totals().totalMs, 60_000);
  assert.equal(s.clock.isActive(base + 160_000), false);
  s.tick(0, {}, true); s.tick(1000);
  assert.equal(s.totals().totalMs, 61_000);
});

test("mode switches split wall time exactly and typing renews the idle deadline", () => {
  const s = session(); s.tick(0, {}, true);
  s.tick(10_000); s.tick(5000, { mode: "review" }, true);
  s.tick(10_000); s.tick(10_000, {}, true); s.tick(10_000);
  assert.deepEqual(s.totals(), { intensiveMs: 15_000, reviewMs: 30_000, totalMs: 45_000 });
});

test("audio can continue beyond a minute without clicking; playback speed counts elapsed wall time", () => {
  const s = session(); s.tick(0, { playing: true, rate: 2 }, true);
  for (let i = 1; i <= 90; i++) s.tick(1000, { position: i * 2 });
  assert.equal(s.totals().totalMs, 90_000);
  s.tick(0, { playing: false });
  for (let i = 0; i < 70; i++) s.tick(1000);
  assert.equal(s.totals().totalMs, 150_000);
});

test("buffering, stalled audio and seeking cannot maintain activity indefinitely", () => {
  const s = session(); s.tick(0, { playing: true }, true);
  for (let i = 0; i < 70; i++) s.tick(1000);
  s.tick(1000, { position: 800, seeking: true });
  s.tick(1000, { seeking: false });
  assert.equal(s.totals().totalMs, 60_000);
});

test("sleep and clock changes do not inflate time; background audio needs matching progress", () => {
  const s = session(); s.tick(0, { playing: true }, true); s.tick(1000, { position: 1 });
  s.tick(3600_000, { monotonic: 1000 });
  s.tick(1000, { playing: false });
  assert.equal(s.totals().totalMs, 1000);
  const background = session(); background.tick(0, { playing: true }, true);
  background.tick(60_000, { position: 60 });
  assert.equal(background.totals().totalMs, 60_000);
  const sleeping = session(); sleeping.tick(0, {}, true); sleeping.tick(3600_000);
  assert.equal(sleeping.totals().totalMs, 0);
});

test("pronunciation can hold the active state; an unobserved sleep still cannot count", () => {
  const s = session(); s.tick(0, { speaking: true }, true);
  for (let i = 0; i < 90; i++) s.tick(1000);
  assert.equal(s.totals().totalMs, 90_000);
  s.tick(3600_000);
  assert.equal(s.totals().totalMs, 90_000);
});

test("overlapping tabs and duplicate retries union; audio then latest interaction chooses the mode", () => {
  const a = span(base, base + 60_000, "intensive");
  const b = span(base + 20_000, base + 70_000, "review");
  const c = span(base + 30_000, base + 40_000, "intensive", "audio", base);
  const merged = mergeStudyIntervals([a, b, c, a, b]);
  const result = summarizeStudyTime(merged, { now: base + 90_000 });
  assert.deepEqual(result.totals, { intensiveMs: 30_000, reviewMs: 40_000, totalMs: 70_000 });
  assert.deepEqual(mergeStudyIntervals([...merged, a, b, c]), merged);
});

test("local midnight and daylight-saving days split without losing seconds", () => {
  const data = [span(base, base + 60_000)];
  const summary = summarizeStudyTime(data, { now: base + 60_000, timeZone: "Asia/Shanghai" });
  assert.equal(summary.days[0].date, "2026-09-18");
  assert.equal(summary.days[0].totalMs, 30_000);
  assert.equal(summary.days[1].totalMs, 30_000);
  const start = Date.parse("2026-03-08T05:00:00Z");
  const end = Date.parse("2026-03-09T04:00:00Z");
  const dst = summarizeStudyTime([span(start, end + 30_000)], { now: end + 30_000, timeZone: "America/New_York" });
  assert.equal(dst.days[1].totalMs, 23 * 3600_000);
  assert.equal(dst.days[0].totalMs, 30_000);
});

test("invalid inputs fail without accepting fabricated future time", () => {
  for (const intervals of [null, [span(base, base)], [span(base, base + 130_000)], [span(base, base + 1000, "bad")], [span(base, base + 1000, "intensive", "bad")]]) {
    assert.throws(() => validateStudyIntervals(intervals, base + 120_000));
  }
  assert.throws(() => validateStudyIntervals([span(base, base + 10_000)], base));
  assert.throws(() => summarizeStudyTime([], { timeZone: "invalid" }));
  assert.throws(() => summarizeStudyTime([], { days: 5000 }));
});

test("simultaneous heartbeats persist atomically, survive restart, and do not duplicate on retry", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "listening-study-store-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "study-time.json");
  const store = createStudyTimeStore(file);
  const start = Date.now() - 100_000;
  const a = [span(start, start + 40_000)];
  const b = [span(start + 30_000, start + 60_000, "review")];
  await Promise.all([store.record(a), store.record(b), store.record(a)]);
  const summary = await createStudyTimeStore(file).summary();
  assert.deepEqual(summary.totals, { intensiveMs: 30_000, reviewMs: 30_000, totalMs: 60_000 });
  assert.equal(formatStudyTime(summary.totals.totalMs), "1 分 0 秒");
  const before = await fs.readFile(file, "utf8");
  await assert.rejects(async () => store.record(a, { timeZone: "invalid" }));
  assert.equal(await fs.readFile(file, "utf8"), before);
});
