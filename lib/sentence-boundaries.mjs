// A transcription chunk is a timing boundary, not a sentence boundary.
const closingMarks = /["'’”»）)\]}]+$/u;
const titleAbbreviation = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Mt|Gen|Rev|Hon)\.$/iu;
const connectiveAbbreviation = /\b(?:e\.g|i\.e|vs|viz|No|Fig)\.$/iu;

function isAbbreviation(text, nextText) {
  const tail = text.trim().replace(closingMarks, "");
  if (!nextText.trim()) return false;
  if (titleAbbreviation.test(tail) || connectiveAbbreviation.test(tail)) return true;
  // Initials and dotted abbreviations can end a sentence too. A lowercase
  // continuation (or a name following a single initial) keeps them together.
  if (/(?:\b[A-Za-z]\.){2,}$/u.test(tail)
    && !/^(?:I|We|You|He|She|It|They|The|This|That|A|An|Then|However)\b/u.test(nextText.trim())) return true;
  if (/(?:^|\s)[A-Z]\.$/u.test(tail) && /^[A-Z][a-z]/u.test(nextText.trim())) return true;
  if (/\b(?:etc|Inc|Ltd|Co|Corp|a\.m|p\.m)\.$/iu.test(tail) && /^[a-z\d]/u.test(nextText.trim())) return true;
  return false;
}

export function hasSentenceEnding(text, nextText = "") {
  const tail = String(text || "").trim().replace(closingMarks, "");
  if (!/[.!?。！？]$/u.test(tail)) return false;
  return !isAbbreviation(tail, String(nextText));
}

export function splitSentenceSpans(value) {
  const text = String(value || "");
  const result = [];
  let start = 0;
  const append = (end) => {
    const raw = text.slice(start, end);
    const trimmed = raw.trim();
    if (trimmed) result.push({ index: start + raw.indexOf(trimmed), segment: trimmed });
    start = end;
  };
  for (const match of text.matchAll(/(?:[。！？]+["'’”»）)\]}]*|[.!?]+["'’”»）)\]}]*(?=\s|$))/gu)) {
    const end = match.index + match[0].length;
    if (hasSentenceEnding(text.slice(start, end), text.slice(end))) append(end);
  }
  append(text.length);
  return result;
}

export function groupSentenceFragments(sentences = []) {
  const groups = [];
  for (const sentence of sentences) {
    const previous = groups.at(-1)?.at(-1);
    const sameSpeaker = previous && String(previous.speaker || "Speaker").trim().toLowerCase()
      === String(sentence.speaker || "Speaker").trim().toLowerCase();
    const validTime = previous && [previous.start, previous.end, sentence.start, sentence.end].every(Number.isFinite)
      && previous.end > previous.start && sentence.end > sentence.start && sentence.start >= previous.start;
    if (sameSpeaker && validTime && previous.text?.trim() && sentence.text?.trim()
      && !hasSentenceEnding(previous.text, sentence.text)) groups.at(-1).push(sentence);
    else groups.push([sentence]);
  }
  return groups;
}

export function joinTimedSentenceParts(parts) {
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const text = parts.map(part => part.text.trim()).join(" ");
  const merged = {
    ...first, text,
    end: Math.max(...parts.map(part => part.end)),
    wordCount: (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length,
    sourceBlockIds: [...new Set(parts.flatMap(part => [part.sourceBlockId, ...(part.sourceBlockIds || [])]).filter(Boolean))],
    timingQuality: parts.every(part => part.timingQuality === "source") ? "source" : "estimated",
  };
  if (parts.every(part => Number.isFinite(part.playbackStart) && Number.isFinite(part.playbackEnd) && part.playbackEnd > part.playbackStart)) {
    merged.playbackStart = Math.min(...parts.map(part => part.playbackStart));
    merged.playbackEnd = Math.max(...parts.map(part => part.playbackEnd));
    merged.playbackAlignmentCoverage = Math.min(...parts.map(part => part.playbackAlignmentCoverage ?? 1));
  } else {
    delete merged.playbackStart;
    delete merged.playbackEnd;
    delete merged.playbackTimingQuality;
    delete merged.playbackAlignmentCoverage;
  }
  return merged;
}
