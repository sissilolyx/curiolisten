const commonWords = new Set("a an the of to in on at and or but is are was were be been being it its i you he she we they this that these those for from with as by do does did have has had not no yes so than then".split(" "));
const words = (text) => String(text || "").match(/[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*/g) || [];

// Find changed word spans, retaining names and short expressions as vocabulary
// hints. These are hints to the recognizer, never automatic text replacements.
export function extractCorrectionHints(previousText, correctedText) {
  const before = words(previousText);
  const after = words(correctedText);
  if (!before.length || !after.length || before.length > 200 || after.length > 200) return [];
  const dp = Array.from({ length: before.length + 1 }, () => new Uint16Array(after.length + 1));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      dp[i][j] = before[i] === after[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hints = [];
  let removed = [], added = [];
  const flush = () => {
    const text = added.join(" ");
    if (added.length && added.length <= 6 && removed.length <= 6 && text.length <= 96
      && added.some(word => /[A-Za-z]/.test(word) && !commonWords.has(word.toLowerCase()))) {
      hints.push({ before: removed.join(" "), after: text });
    }
    removed = []; added = [];
  };
  let i = 0, j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) { flush(); i++; j++; }
    else if (i < before.length && (j === after.length || dp[i + 1][j] >= dp[i][j + 1])) removed.push(before[i++]);
    else added.push(after[j++]);
  }
  flush();
  // A substantially rewritten sentence should not seed recognition vocabulary.
  if (Math.max(before.length, after.length) > 8 && dp[0][0] < Math.min(before.length, after.length) / 2) return [];
  return hints;
}

export function buildRecognitionHints(corrections, { maxCharacters = 600, maxWords = 80 } = {}) {
  const seen = new Set();
  const selected = [];
  let wordCount = 0;
  for (const correction of [...corrections].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))) {
    if (!correction.enabled) continue;
    for (const hint of extractCorrectionHints(correction.previousText, correction.correctedText)) {
      const key = hint.after.toLowerCase();
      const nextCount = wordCount + words(hint.after).length;
      if (seen.has(key) || nextCount > maxWords) continue;
      if ([...selected, hint.after].join(", ").length > maxCharacters) continue;
      seen.add(key); selected.push(hint.after); wordCount = nextCount;
    }
  }
  return { prompt: selected.join(", "), terms: selected };
}
