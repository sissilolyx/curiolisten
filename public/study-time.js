import { StudyClock, formatStudyTime } from "./study-clock.js";

const OUTBOX_PREFIX = "listening-study-outbox-v1-";

export function startStudyTime({ elements, getMode, getMedia, isSpeaking }) {
  const clock = new StudyClock();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const key = OUTBOX_PREFIX + crypto.randomUUID();
  let pending = [];
  let inFlight = false;
  let summary = null;
  let saveError = false;
  let storageError = false;
  let suspended = false;
  let opener;
  let speechStarted = false;
  const sample = () => {
    const media = getMedia();
    return { now: Date.now(), monotonic: performance.now(), mode: getMode(),
      mediaKey: media?.src || "", position: media?.currentTime || 0, rate: media?.playbackRate || 1,
      playing: Boolean(media && !media.paused && !media.ended && !media.seeking && !media.muted && media.volume > 0 && media.readyState >= 2),
      seeking: Boolean(media?.seeking), speaking: speechStarted && isSpeaking() };
  };
  const persist = () => {
    try {
      if (pending.length) localStorage.setItem(key, JSON.stringify(pending));
      else localStorage.removeItem(key);
      storageError = false;
    } catch { storageError = true; }
  };
  const renderStatus = () => {
    const active = clock.isActive(Date.now());
    const label = getMode() === "review" ? "复习" : "精听";
    elements.studyTimeStatus.textContent = saveError ? "暂时无法保存，恢复连接后会自动补记。"
      : storageError ? "浏览器暂存不可用，请保持页面开启，等待保存完成。"
      : active ? `正在记录${label}时长` : "计时已暂停 · 播放或交互后继续";
    elements.studyTimeStatus.classList.toggle("is-active", active && !saveError);
  };
  const pulse = (interaction = false) => {
    if (suspended) return;
    const intervals = clock.pulse(sample(), interaction);
    pending.push(...intervals);
    if (intervals.length) persist();
    renderStatus();
  };
  const render = () => {
    if (!summary) return;
    const today = summary.today;
    elements.studyTimeToday.textContent = `今日 ${formatStudyTime(today.totalMs)}`;
    elements.studyTimeButton.title = `学习统计 · 今日 ${formatStudyTime(today.totalMs)}`;
    for (const [id, value] of Object.entries({ studyTimeTotal: today.totalMs, studyTimeIntensive: today.intensiveMs,
      studyTimeReview: today.reviewMs, studyTimeWeek: summary.week.totalMs, studyTimeAll: summary.totals.totalMs })) {
      elements[id].textContent = formatStudyTime(value);
    }
    elements.studyTimeDays.textContent = `${summary.studyDays} 天`;
    elements.studyTimeZone.textContent = `按本机时区 ${summary.timeZone} 归日；仅记录功能启用后的学习。`;
    const max = Math.max(1, ...summary.days.map(day => day.totalMs));
    elements.studyTimeDaily.replaceChildren(...summary.days.map(day => {
      const row = document.createElement("tr");
      const date = document.createElement("th");
      date.scope = "row";
      date.textContent = day.date === today.date ? `${day.date.slice(5)} 今天` : day.date;
      const bar = document.createElement("span");
      bar.className = "study-time-bar";
      bar.setAttribute("aria-hidden", "true");
      for (const [mode, value] of [["intensive", day.intensiveMs], ["review", day.reviewMs]]) {
        const part = document.createElement("i");
        part.className = mode;
        part.style.width = `${value / max * 100}%`;
        bar.append(part);
      }
      date.append(bar); row.append(date);
      for (const value of [day.intensiveMs, day.reviewMs, day.totalMs]) {
        const cell = document.createElement("td"); cell.textContent = formatStudyTime(value); row.append(cell);
      }
      return row;
    }));
    renderStatus();
  };
  const options = () => ({ timeZone, days: Number(elements.studyTimeRange.value) });
  const request = async (intervals, keepalive = false) => {
    const query = new URLSearchParams(options());
    const response = await fetch(intervals ? "/api/study-time/heartbeat" : `/api/study-time?${query}`, intervals
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...options(), intervals }), keepalive }
      : { cache: "no-store" });
    if (!response.ok) throw new Error("Study heartbeat failed");
    return response.json();
  };
  const flush = async (keepalive = false) => {
    if (inFlight) return;
    inFlight = true;
    const batch = pending.slice(0, 200);
    try {
      summary = await request(batch.length ? batch : null, keepalive);
      pending = pending.slice(batch.length);
      persist(); saveError = false; render();
    } catch { saveError = true; renderStatus(); }
    finally {
      inFlight = false;
      if (!saveError && batch.length === 200 && pending.length && !keepalive) queueMicrotask(() => void flush());
    }
  };
  // Reload/crash recovery. Retried intervals are unioned by the server, so even
  // another still-open tab's outbox is safe to deliver more than once.
  const recover = async () => {
    try {
      const keys = Object.keys(localStorage).filter(item => item.startsWith(OUTBOX_PREFIX) && item !== key);
      for (const otherKey of keys) {
        const original = localStorage.getItem(otherKey);
        let intervals;
        try { intervals = JSON.parse(original); } catch { continue; }
        if (!Array.isArray(intervals)) continue;
        for (let i = 0; i < intervals.length; i += 200) await request(intervals.slice(i, i + 200));
        if (localStorage.getItem(otherKey) === original) localStorage.removeItem(otherKey);
      }
    } catch { saveError = true; }
  };
  for (const event of ["pointerdown", "click", "keydown", "input", "wheel", "touchmove"]) {
    document.addEventListener(event, e => { if (e.isTrusted && !document.hidden) pulse(true); }, { capture: true, passive: true });
  }
  for (const event of ["play", "playing", "pause", "ended", "waiting", "seeking", "seeked", "ratechange", "volumechange", "timeupdate"]) {
    document.addEventListener(event, () => pulse(), true);
  }
  document.addEventListener("visibilitychange", () => { pulse(); void flush(true); });
  window.addEventListener("pagehide", () => { pulse(); suspended = true; void flush(true); });
  window.addEventListener("pageshow", () => { suspended = false; clock.previous = null; clock.activeUntil = 0; pulse(); });
  window.addEventListener("online", () => { void recover().then(() => flush()); });
  elements.studyTimeButton.addEventListener("click", () => {
    opener = document.activeElement;
    elements.studyTimeDialog.showModal(); render(); void flush();
  });
  const close = () => { elements.studyTimeDialog.close(); opener?.focus(); };
  elements.closeStudyTimeButton.addEventListener("click", close);
  elements.studyTimeDialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  elements.studyTimeRange.addEventListener("change", () => { void flush(); });
  setInterval(() => pulse(), 1000);
  setInterval(() => { void recover().then(() => flush()); }, 15_000);
  pulse(); void recover().then(() => flush());
  return { pulse, speechStart() { pulse(); speechStarted = true; pulse(); }, speechEnd() { pulse(); speechStarted = false; pulse(); } };
}
