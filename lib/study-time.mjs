import fs from "node:fs/promises";
import path from "node:path";
import { DATA_ROOT } from "./config.mjs";

const MODES = ["intensive", "review"];
const error = message => Object.assign(new Error(message), { statusCode: 400 });
export function validateStudyIntervals(intervals, now = Date.now()) {
  if (!Array.isArray(intervals) || intervals.length > 500) throw error("学习心跳格式无效");
  return intervals.map(item => {
    const { start, end, mode, kind, activityAt } = item || {};
    if (![start, end, activityAt].every(Number.isSafeInteger) || start < 0 || end <= start
      || end - start > 120_000 || end > now + 5000 || activityAt < 0 || activityAt > end
      || !MODES.includes(mode) || !["interaction", "audio"].includes(kind)) throw error("学习时段无效");
    return { start, end, mode, kind, activityAt };
  });
}

const same = (a, b) => a.mode === b.mode && a.kind === b.kind && a.activityAt === b.activityAt;
const priority = (a, b) => (a.kind === "audio") - (b.kind === "audio")
  || a.activityAt - b.activityAt || a.mode.localeCompare(b.mode);

// Union every tab/retry before counting. Audible playback takes precedence;
// otherwise the most recent interaction owns overlapping time in its mode.
export function mergeStudyIntervals(intervals) {
  const events = intervals.flatMap((item, id) => [{ at: item.start, id, item, start: true }, { at: item.end, id, start: false }])
    .sort((a, b) => a.at - b.at);
  const active = new Map();
  const result = [];
  let previous = null;
  for (let index = 0; index < events.length;) {
    const at = events[index].at;
    if (previous !== null && at > previous && active.size) {
      let winner;
      for (const item of active.values()) if (!winner || priority(item, winner) > 0) winner = item;
      const last = result.at(-1);
      if (last && last.end === previous && same(last, winner)) last.end = at;
      else result.push({ ...winner, start: previous, end: at });
    }
    while (index < events.length && events[index].at === at) {
      const event = events[index++];
      if (event.start) active.set(event.id, event.item);
      else active.delete(event.id);
    }
    previous = at;
  }
  return result;
}

function dateFormatter(timeZone) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }); }
  catch { throw error("统计时区无效"); }
}
const dayKey = (formatter, time) => {
  const parts = Object.fromEntries(formatter.formatToParts(time).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const emptyTotals = () => ({ intensiveMs: 0, reviewMs: 0, totalMs: 0 });
const add = (target, mode, ms) => { target[`${mode}Ms`] += ms; target.totalMs += ms; };

export function summarizeStudyTime(intervals, { timeZone = "Asia/Shanghai", now = Date.now(), days = 7 } = {}) {
  const formatter = dateFormatter(timeZone);
  if (![7, 30, 90].includes(days)) throw error("统计范围无效");
  const totals = emptyTotals();
  const byDay = new Map();
  for (const item of intervals) {
    let start = item.start;
    while (start < item.end) {
      const date = dayKey(formatter, start);
      let end = item.end;
      if (dayKey(formatter, end - 1) !== date) {
        // Find the local midnight, including daylight-saving transitions.
        let low = start, high = Math.min(item.end, start + 27 * 3600_000);
        while (high - low > 1) {
          const mid = Math.floor((low + high) / 2);
          if (dayKey(formatter, mid) === date) low = mid; else high = mid;
        }
        end = high;
      }
      if (!byDay.has(date)) byDay.set(date, { date, ...emptyTotals() });
      add(byDay.get(date), item.mode, end - start);
      add(totals, item.mode, end - start);
      start = end;
    }
  }
  const today = dayKey(formatter, now);
  const calendar = new Date(`${today}T12:00:00Z`);
  const recentDays = Array.from({ length: days }, (_, index) => {
    const date = new Date(calendar.getTime() - index * 86400_000).toISOString().slice(0, 10);
    return byDay.get(date) || { date, ...emptyTotals() };
  });
  const week = recentDays.slice(0, 7).reduce((sum, day) => {
    add(sum, "intensive", day.intensiveMs); add(sum, "review", day.reviewMs); return sum;
  }, emptyTotals());
  return { timeZone, today: recentDays[0], week, totals, days: recentDays, studyDays: byDay.size,
    startedAt: intervals.length ? intervals[0].start : null };
}

export function createStudyTimeStore(file = path.join(DATA_ROOT, "study-time.json")) {
  let tail = Promise.resolve();
  const read = async () => {
    try {
      const saved = JSON.parse(await fs.readFile(file, "utf8"));
      if (saved.version !== 1 || !Array.isArray(saved.intervals)) throw new Error("学习统计文件格式无效");
      return saved.intervals;
    } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  };
  return {
    async summary(options) { await tail; return summarizeStudyTime(await read(), options); },
    record(input, options) {
      const intervals = validateStudyIntervals(input);
      // Validate before any mutation, and serialize concurrent heartbeat writes.
      summarizeStudyTime([], options);
      const operation = tail.then(async () => {
        const merged = mergeStudyIntervals([...(await read()), ...intervals]);
        if (intervals.length) {
          await fs.mkdir(path.dirname(file), { recursive: true });
          const temporary = `${file}.tmp`;
          await fs.writeFile(temporary, JSON.stringify({ version: 1, intervals: merged }));
          await fs.rename(temporary, file);
        }
        return summarizeStudyTime(merged, options);
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };
}
