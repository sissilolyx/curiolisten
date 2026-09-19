export const IDLE_MS = 60_000;
const MAX_UNOBSERVED_MS = 15_000;

// Wall time is what we measure, not the number of seconds skipped in the media.
export class StudyClock {
  constructor() {
    this.previous = null;
    this.activeUntil = 0;
    this.activityAt = 0;
  }

  pulse(sample, interaction = false) {
    const previous = this.previous;
    const intervals = [];
    if (previous) {
      const elapsed = sample.now - previous.now;
      const awake = elapsed > 0 && Math.abs(elapsed - (sample.monotonic - previous.monotonic)) < 2000;
      const moved = sample.position - previous.position;
      const audioMs = moved / previous.rate * 1000;
      const audio = awake && previous.playing && !sample.seeking && sample.mediaKey === previous.mediaKey
        && moved > 0 && audioMs <= elapsed + 750;
      const speech = awake && elapsed <= MAX_UNOBSERVED_MS && previous.speaking && sample.speaking;
      const add = (start, end, kind) => {
        start = Math.round(start); end = Math.round(end);
        for (let at = start; at < end; at += 60_000) {
          intervals.push({ start: at, end: Math.min(end, at + 60_000), mode: previous.mode, kind, activityAt: this.activityAt || start });
        }
      };
      if (awake && elapsed <= MAX_UNOBSERVED_MS) {
        add(previous.now, Math.min(sample.now, this.activeUntil), "interaction");
      } else if (elapsed !== 0) {
        // An open page cannot claim an unobserved sleep/suspension interval.
        this.activeUntil = 0;
      }
      if (audio || speech) {
        add(Math.max(previous.now, sample.now - (speech ? elapsed : audioMs)), sample.now, "audio");
        this.activeUntil = sample.now + IDLE_MS;
      }
    }
    if (interaction) {
      this.activityAt = sample.now;
      this.activeUntil = sample.now + IDLE_MS;
    }
    this.previous = sample;
    return intervals;
  }

  isActive(now) { return now < this.activeUntil; }
}

export function formatStudyTime(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} 分 ${seconds % 60} 秒` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
}
