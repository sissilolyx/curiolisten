import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("study heartbeat API persists mode totals, rejects cross-origin writes and leaves materials alone", { timeout: 20_000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "listening-study-api-"));
  const probe = net.createServer().listen(0, "127.0.0.1"); await once(probe, "listening");
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ["server.mjs"], { cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, PORT: String(port), LISTENING_DATA_DIR: root, LISTENING_PRESERVE_DATA: "1", SKIP_CODEX_ANALYSIS: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  t.after(async () => {
    if (server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
    await fs.rm(root, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timeout")), 5000);
    server.stdout.on("data", output => { if (String(output).includes("原声精听已启动")) { clearTimeout(timer); resolve(); } });
    server.once("error", reject);
  });
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await (await fetch(`${base}/api/study-time`)).json()).totals.totalMs, 0);
  await assert.rejects(() => fs.access(path.join(root, "study-time.json")));
  const start = Date.now() - 100_000;
  const body = { intervals: [{ start, end: start + 30_000, mode: "intensive", kind: "audio", activityAt: start },
    { start: start + 30_000, end: start + 50_000, mode: "review", kind: "interaction", activityAt: start + 30_000 }], timeZone: "Asia/Shanghai", days: 30 };
  const post = (value = body, extra = {}) => fetch(`${base}/api/study-time/heartbeat`, { method: "POST", headers: { "Content-Type": "application/json", ...extra }, body: JSON.stringify(value) });
  const totals = { intensiveMs: 30_000, reviewMs: 20_000, totalMs: 50_000 };
  assert.deepEqual((await (await post()).json()).totals, totals);
  assert.deepEqual((await (await post()).json()).totals, totals);
  assert.equal((await post(body, { Origin: "https://example.com" })).status, 403);
  assert.equal((await post({ ...body, intervals: [{ ...body.intervals[0], mode: "bad" }] })).status, 400);
  assert.equal((await fetch(`${base}/api/study-time?timeZone=Invalid`)).status, 400);
  const read = await (await fetch(`${base}/api/study-time?days=30`)).json();
  assert.deepEqual(read.totals, totals); assert.equal(read.days.length, 30);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "study-time.json"), "utf8")).intervals.length, 2);
  assert.deepEqual(await fs.readdir(path.join(root, "materials")), []);
  assert.deepEqual(await fs.readdir(path.join(root, "jobs")), []);
});
