import { groupSentenceFragments, joinTimedSentenceParts } from "./sentence-boundaries.mjs";

const VERSION = 2;
const unique = values => [...new Set(values.filter(Boolean))];

export function canonicalSentenceId(material, id) {
  return material.sentences?.find(sentence => sentence.id === id || sentence.mergedFromSentenceIds?.includes(id))?.id || id;
}

export function canonicalParagraphId(material, id) {
  return material.paragraphs?.find(paragraph => paragraph.id === id)?.id
    || material.paragraphs?.find(paragraph => paragraph.mergedFromParagraphIds?.includes(id))?.id || id;
}

// Upgrade legacy chunk boundaries in the app's normal material read/write
// path. Keep the originals and stable leading IDs so personal records survive.
export function normalizeMaterialSentenceBoundaries(material) {
  if (material.sentenceBoundaryVersion === VERSION || !material.sentences?.length) return material;
  if (material.sentenceBoundaryVersion === 1 && material.sentenceBoundaryHistory?.length) {
    const aliases = new Map(material.sentences.flatMap(sentence => (
      [sentence.id, ...(sentence.mergedFromSentenceIds || [])].map(id => [id, { sentence }])
    )));
    const originalParagraphs = material.sentenceBoundaryHistory[0].paragraphs;
    material.paragraphs = remapParagraphs(originalParagraphs, aliases, material.sentences);
    for (const item of material.reviewItems || []) {
      if (item.kind !== "paragraph") continue;
      const original = originalParagraphs.find(paragraph => paragraph.text && paragraph.text === item.sourceText);
      if (original) item.originalParagraphId ||= original.id;
      item.paragraphId = canonicalParagraphId(material, item.originalParagraphId || item.paragraphId);
    }
    material.sentenceBoundaryVersion = VERSION;
    return material;
  }
  const groups = groupSentenceFragments(material.sentences);
  const changedGroups = groups.filter(parts => parts.length > 1);
  material.sentenceBoundaryVersion = VERSION;
  if (!changedGroups.length) return material;

  const aliases = new Map();
  const progress = material.progress || {};
  material.sentenceBoundaryHistory = [...(material.sentenceBoundaryHistory || []), {
    version: VERSION,
    sentences: structuredClone(changedGroups.flat()),
    paragraphs: structuredClone(material.paragraphs || []),
    progress: structuredClone(Object.fromEntries(changedGroups.flat().filter(part => progress[part.id]).map(part => [part.id, progress[part.id]]))),
  }];
  material.sentences = groups.map(parts => {
    const sentence = joinTimedSentenceParts(parts);
    let offset = 0;
    for (const part of parts) {
      aliases.set(part.id, { sentence, part, offset });
      offset += part.text.trim().length + 1;
    }
    if (parts.length === 1) return sentence;
    sentence.mergedFromSentenceIds = unique(parts.flatMap(part => [part.id, ...(part.mergedFromSentenceIds || [])]));
    const available = parts.filter(part => part.analysis);
    const combinedAnalysis = combineFragmentAnalysis(available);
    sentence.analysis = available.length === parts.length ? combinedAnalysis : null;
    if (!sentence.analysis && combinedAnalysis) sentence.previousAnalysis = combinedAnalysis;
    const entries = parts.map(part => progress[part.id] || {});
    if (entries.some(entry => Object.keys(entry).length)) {
      progress[sentence.id] = {
        ...progress[sentence.id],
        heard: entries.every(entry => entry.heard || entry.status === "mastered"),
        dictation: unique(entries.map(entry => entry.dictation)).join("\n"),
      };
      if (entries.some(entry => entry.status === "review")) progress[sentence.id].status = "review";
      else delete progress[sentence.id].status;
    }
    return sentence;
  });
  material.progress = progress;
  material.paragraphs = remapParagraphs(material.paragraphs || [], aliases, material.sentences);
  const paragraphAliases = new Map(material.paragraphs.flatMap(paragraph => (
    [paragraph.id, ...(paragraph.mergedFromParagraphIds || [])].map(id => [id, paragraph.id])
  )));
  for (const collection of [material.reviewItems, material.qaHistory, material.phraseGuides, material.transcriptCorrections]) {
    for (const item of collection || []) {
      if (item.paragraphId && paragraphAliases.has(item.paragraphId)) {
        item.originalParagraphId ||= item.paragraphId;
        item.paragraphId = paragraphAliases.get(item.paragraphId);
      }
      const alias = aliases.get(item.sentenceId);
      if (!alias || !alias.sentence.mergedFromSentenceIds) continue;
      const { sentence, part, offset } = alias;
      item.originalSentenceId ||= item.sentenceId;
      item.sentenceId = sentence.id;
      if (item.anchorSurface === "original" && item.anchorSurfaceText === part.text
        && Number.isInteger(item.anchorStart) && Number.isInteger(item.anchorEnd)) {
        item.anchorStart += offset;
        item.anchorEnd += offset;
        item.anchorSurfaceText = sentence.text;
        item.prefix = sentence.text.slice(Math.max(0, item.anchorStart - 256), item.anchorStart);
        item.suffix = sentence.text.slice(item.anchorEnd, item.anchorEnd + 256);
      }
      if (item.sourceSentenceText === part.text) {
        item.originalSourceSentenceText ||= item.sourceSentenceText;
        item.sourceSentenceText = sentence.text;
      }
      if (item.key?.startsWith(`${part.id}|`)) item.key = `${sentence.id}|${item.key.slice(part.id.length + 1)}`;
    }
  }
  return material;
}

function combineFragmentAnalysis(parts) {
  if (!parts.length) return null;
  const analyses = parts.map(part => part.analysis);
  const merged = {
    ...analyses[0],
    translationZh: analyses.map(analysis => (analysis.translationZh || "").trim()).filter(Boolean)
      .reduce((text, part) => `${text}${/[A-Za-z0-9]$/u.test(text) && /^[A-Za-z0-9]/u.test(part) ? " " : ""}${part}`, ""),
    explanationZh: analyses.map(analysis => analysis.explanationZh || "").filter(Boolean).join("\n\n"),
    phrases: analyses.flatMap(analysis => analysis.phrases || []),
    questionZh: analyses.map(analysis => analysis.questionZh || "").filter(Boolean).join("\n"),
    derivedFromFragments: true,
  };
  if (analyses.every(analysis => Array.isArray(analysis.spokenFormNotes))) merged.spokenFormNotes = analyses.flatMap(analysis => analysis.spokenFormNotes);
  else delete merged.spokenFormNotes;
  return merged;
}

function remapParagraphs(paragraphs, aliases, sentences) {
  const result = [];
  const byId = new Map(sentences.map(sentence => [sentence.id, sentence]));
  const ownerBySentence = new Map();
  for (const original of paragraphs) {
    const paragraph = {
      ...original,
      sentenceIds: unique((original.sentenceIds || []).map(id => aliases.get(id)?.sentence.id || id)),
      trailingContextSentenceIds: unique((original.trailingContextSentenceIds || []).map(id => aliases.get(id)?.sentence.id || id)),
    };
    // Only move the continuation of a sentence. Merging entire neighbouring
    // paragraphs transitively would turn several 100-word units into one huge
    // exercise whenever each boundary happens to cross a sentence.
    for (const id of paragraph.sentenceIds) {
      const owner = ownerBySentence.get(id);
      if (owner) owner.mergedFromParagraphIds = unique([...(owner.mergedFromParagraphIds || []), owner.id, ...(paragraph.mergedFromParagraphIds || []), paragraph.id]);
    }
    paragraph.sentenceIds = paragraph.sentenceIds.filter(id => !ownerBySentence.has(id));
    if (paragraph.sentenceIds.length) {
      paragraph.sentenceIds.forEach(id => ownerBySentence.set(id, paragraph));
      result.push(paragraph);
    } else if (result.length) {
      result.at(-1).trailingContextSentenceIds = unique([...result.at(-1).trailingContextSentenceIds, ...paragraph.trailingContextSentenceIds]);
    }
  }
  return result.map(paragraph => {
    const items = paragraph.sentenceIds.map(id => byId.get(id)).filter(Boolean);
    if (!items.length) return paragraph;
    return {
      ...paragraph,
      start: items[0].start,
      end: items.at(-1).end,
      text: items.map(item => item.text).join(" "),
      wordCount: items.reduce((sum, item) => sum + (item.wordCount || 0), 0),
      sourceBlockIds: unique(items.flatMap(item => [item.sourceBlockId, ...(item.sourceBlockIds || [])])),
      trailingContextSentenceIds: paragraph.trailingContextSentenceIds.filter(id => !paragraph.sentenceIds.includes(id)),
    };
  });
}
