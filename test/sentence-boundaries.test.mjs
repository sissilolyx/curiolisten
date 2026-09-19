import assert from "node:assert/strict";
import test from "node:test";
import { blocksToSentences, buildParagraphs, parseWhisperJson } from "../lib/transcript.mjs";
import { splitSentenceSpans } from "../lib/sentence-boundaries.mjs";
import { canonicalParagraphId, normalizeMaterialSentenceBoundaries } from "../lib/material-sentence-boundaries.mjs";
import { resolveTextAnchor } from "../public/ask-text-anchor-utils.js";
import { hasReliableSentencePlayback, resolveSentencePlaybackRange } from "../public/playback-range-utils.js";
import { buildMaterialReviewQueue } from "../lib/review-queue.mjs";
import { mergeSentenceAnalysis } from "../lib/importers.mjs";

test("Whisper chunk ends never split a sentence before its period", () => {
  const examples = [
    [54, 59, 60, "The little clockwork fox carried a basket of painted wooden stars along the path", "that leads to the paper castle."],
    [87, 93, 95, "In the toy workshop, a row of tiny brass turtles waited beside the newly painted", "blue lantern on the shelf."],
  ];
  for (const [start, middle, end, first, last] of examples) {
    const blocks = parseWhisperJson({ transcription: [
      { offsets: { from: start * 1000, to: middle * 1000 }, text: first, tokens: [{ text: first, offsets: { from: start * 1000, to: middle * 1000 } }] },
      { offsets: { from: middle * 1000, to: end * 1000 }, text: last, tokens: [{ text: last, offsets: { from: middle * 1000, to: end * 1000 } }] },
    ] });
    const sentences = blocksToSentences(blocks);
    assert.equal(sentences.length, 1);
    assert.equal(sentences[0].text, `${first} ${last}`);
    assert.equal(sentences[0].start, start);
    assert.equal(sentences[0].end, end);
    assert.equal(hasReliableSentencePlayback(sentences[0], 200, { sourceType: "youtube" }), true);
    assert.equal(resolveSentencePlaybackRange({ sentence: sentences[0] }).end, end);
    assert.equal(buildParagraphs(sentences, 5).length, 1, "paragraph word limits must not split the complete sentence");
  }
});

test("punctuation handles lower-case continuations, abbreviations, decimals, quotes and questions", () => {
  const text = 'Dr. Smith paid 3.14 dollars, e.g. for a U.S. stamp. did it work? "Yes!" Next sentence.';
  const spans = splitSentenceSpans(text);
  assert.deepEqual(spans.map(part => part.segment), [
    'Dr. Smith paid 3.14 dollars, e.g. for a U.S. stamp.', 'did it work?', '"Yes!"', 'Next sentence.',
  ]);
  for (const part of spans) assert.equal(text.slice(part.index, part.index + part.segment.length), part.segment);
  assert.deepEqual(splitSentenceSpans('请先听完。再开始！').map(part => part.segment), ['请先听完。', '再开始！']);
  assert.deepEqual(splitSentenceSpans('The U.S. Army is here. It helps.').map(part => part.segment), ['The U.S. Army is here.', 'It helps.']);
});

test("several chunks join without word or duration limits, while speaker turns and completed sentences remain separate", () => {
  const blocks = [
    { id: 'a', speaker: 'A', start: 0, end: 3, text: 'Dr.' },
    { id: 'b', speaker: 'A', start: 3, end: 20, text: 'Smith brought a remarkable example,' },
    { id: 'c', speaker: 'A', start: 22, end: 25, text: 'which we can discuss today.' },
    { id: 'd', speaker: 'A', start: 25, end: 27, text: 'Another thought' },
    { id: 'e', speaker: 'B', start: 27, end: 30, text: 'Let me answer.' },
  ];
  const sentences = blocksToSentences(blocks);
  assert.deepEqual(sentences.map(s => s.text), ['Dr. Smith brought a remarkable example, which we can discuss today.', 'Another thought', 'Let me answer.']);
  assert.equal(sentences[0].end, 25);
  assert.deepEqual(sentences[0].sourceBlockIds, ['a', 'b', 'c']);
});

test("legacy joining preserves original data, review links, question anchors and aligned full-sentence audio", () => {
  const material = legacyMaterial();
  const before = structuredClone(material);
  normalizeMaterialSentenceBoundaries(material);
  assert.equal(material.sentences.length, 2);
  const sentence = material.sentences[0];
  assert.equal(sentence.id, 'sentence-1');
  assert.equal(sentence.text, 'We keep the painted lantern that glows softly by the castle.');
  assert.deepEqual(sentence.mergedFromSentenceIds, ['sentence-1', 'sentence-2']);
  assert.equal(sentence.playbackStart, 53.9);
  assert.equal(sentence.playbackEnd, 60.1);
  assert.equal(sentence.analysis.phrases.length, 2);
  assert.equal(sentence.analysis.translationZh, '我们保留这盏彩灯，它在城堡边柔和发光。');
  assert.equal(sentence.analysis.derivedFromFragments, true);
  assert.equal(material.progress['sentence-1'].heard, true);
  assert.equal(material.progress['sentence-1'].status, 'review');
  assert.equal(material.progress['sentence-2'].dictation, 'my dictation');
  assert.deepEqual(material.sentenceBoundaryHistory[0].sentences, before.sentences.slice(0, 2));
  assert.deepEqual(material.sentenceBoundaryHistory[0].paragraphs, before.paragraphs);
  assert.deepEqual(material.reviewItems.map(item => item.id), before.reviewItems.map(item => item.id));
  assert.equal(material.qaHistory[0].answerZh, before.qaHistory[0].answerZh);
  assert.equal(material.qaHistory[0].sentenceId, 'sentence-1');
  assert.equal(material.qaHistory[0].originalSentenceId, 'sentence-2');
  const resolved = resolveTextAnchor(sentence.text, material.qaHistory[0]);
  assert.equal(resolved.exact, 'glows softly');
  assert.equal(sentence.text.slice(resolved.start, resolved.end), 'glows softly');
  assert.equal(material.phraseGuides[0].sourceSentenceText, sentence.text);
  assert.equal(material.phraseGuides[0].key, 'sentence-1|glows softly');
  assert.equal(material.transcriptCorrections[0].sentenceId, 'sentence-1');
  assert.equal(material.paragraphs.length, 2, 'move only the continued sentence, preserving the next exercise');
  assert.deepEqual(material.paragraphs[0].sentenceIds, ['sentence-1']);
  assert.deepEqual(material.paragraphs[1].sentenceIds, ['sentence-3']);
  assert.deepEqual(material.paragraphs[0].mergedFromParagraphIds, ['paragraph-1', 'paragraph-2']);
  assert.equal(canonicalParagraphId(material, 'paragraph-2'), 'paragraph-2');
  assert.equal(buildMaterialReviewQueue(material)[0].review.itemIds.length, 3);
  const once = structuredClone(material);
  normalizeMaterialSentenceBoundaries(material);
  assert.deepEqual(material, once, 'normalization must be idempotent');
  const stale = mergeSentenceAnalysis(material.sentences, before.sentences);
  assert.deepEqual(stale[0], sentence, 'an old fragment analysis cannot overwrite merged text or analysis');
});

test("materials read during a live update retain bounded exercise sizes without redoing sentence migration", () => {
  const material = legacyMaterial();
  normalizeMaterialSentenceBoundaries(material);
  const archived = structuredClone(material.sentenceBoundaryHistory);
  const sentences = structuredClone(material.sentences);
  material.sentenceBoundaryVersion = 1;
  material.paragraphs = [{ ...material.paragraphs[0], sentenceIds: ['sentence-1', 'sentence-3'], end: 64 }];
  normalizeMaterialSentenceBoundaries(material);
  assert.equal(material.paragraphs.length, 2);
  assert.deepEqual(material.paragraphs.map(p => p.sentenceIds), [['sentence-1'], ['sentence-3']]);
  assert.deepEqual(material.sentences, sentences);
  assert.deepEqual(material.sentenceBoundaryHistory, archived);
});

test("partial previous analysis remains available while the merged sentence awaits a complete explanation", () => {
  const material = legacyMaterial();
  material.sentences[1].analysis = null;
  material.progress['sentence-2'].heard = false;
  delete material.sentences[1].playbackStart;
  normalizeMaterialSentenceBoundaries(material);
  assert.equal(material.sentences[0].analysis, null);
  assert.ok(material.sentences[0].previousAnalysis.explanationZh);
  assert.equal(material.progress['sentence-1'].heard, false);
  assert.equal(material.sentences[0].playbackStart, undefined, 'do not keep a truncated partial alignment');
});

function legacyMaterial() {
  const text = 'that glows softly by the castle.';
  return {
    id: 'material-synthetic', title: 'Synthetic split sentence', status: 'ready', sourceType: 'youtube',
    sentences: [
      { id: 'sentence-1', sourceBlockId: 'block-1', speaker: 'Speaker', start: 54, end: 59, playbackStart: 53.9, playbackEnd: 59.1, timingQuality: 'source', text: 'We keep the painted lantern', analysis: { translationZh: '我们保留这盏彩灯，', explanationZh: '第一部分已有讲解。', spokenFormNotes: [], phrases: [{ text: 'painted lantern' }] } },
      { id: 'sentence-2', sourceBlockId: 'block-2', speaker: 'Speaker', start: 59, end: 60, playbackStart: 58.9, playbackEnd: 60.1, timingQuality: 'source', text, analysis: { translationZh: '它在城堡边柔和发光。', explanationZh: '第二部分已有讲解。', spokenFormNotes: [], phrases: [{ text: 'glows softly' }] } },
      { id: 'sentence-3', speaker: 'Speaker', start: 60, end: 64, text: 'Now we can move on.', analysis: { spokenFormNotes: [] } },
    ],
    paragraphs: [
      { id: 'paragraph-1', sentenceIds: ['sentence-1'], start: 54, end: 59 },
      { id: 'paragraph-2', sentenceIds: ['sentence-2', 'sentence-3'], start: 59, end: 64 },
    ],
    progress: { 'sentence-1': { heard: true }, 'sentence-2': { heard: true, status: 'review', dictation: 'my dictation' } },
    reviewItems: [
      { id: 'review-phrase', kind: 'phrase', sentenceId: 'sentence-2', sourceText: 'glows softly' },
      { id: 'review-explanation-sentence-2', kind: 'qa', sentenceId: 'sentence-2', answerZh: 'Saved explanation' },
      { id: 'review-paragraph', kind: 'paragraph', paragraphId: 'paragraph-2' },
    ],
    qaHistory: [{ id: 'question-1', sentenceId: 'sentence-2', sourceText: 'glows softly', question: 'Meaning?', answerZh: 'Saved answer', anchorSurface: 'original', anchorSurfaceText: text, anchorExact: 'glows softly', anchorStart: 5, anchorEnd: 17 }],
    phraseGuides: [{ id: 'guide-1', sentenceId: 'sentence-2', key: 'sentence-2|glows softly', sourceSentenceText: text }],
    transcriptCorrections: [{ id: 'correction-1', sentenceId: 'sentence-2', previousText: 'old', correctedText: text, enabled: true }],
  };
}
