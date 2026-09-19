import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createExplanationReview, explanationReviewText, findExplanationReview, isExplanationReview } from '../public/explanation-review-utils.js';
import { buildMaterialReviewQueue } from '../lib/review-queue.mjs';

const original = {
  id: 'sentence-synthetic', text: 'A paper dragon rests beside a velvet tower.', start: 0, end: 5,
  timingQuality: 'source', analysis: { explanationZh: 'beside 表示纸龙与绒布塔的位置关系。' },
};

test('explanations have stable independent review identities and retain their saved wording', () => {
  const review = createExplanationReview(original, original.analysis.explanationZh);
  assert.equal(isExplanationReview(review), true);
  assert.equal(createExplanationReview(original, 'Updated explanation').id, review.id);
  const phrase = { id: 'review-phrase', kind: 'phrase', sentenceId: original.id, sourceText: original.text };
  const question = { id: 'review-question', kind: 'qa', sentenceId: original.id, answerZh: 'A separate answer' };
  const material = { reviewItems: [phrase, question, review] };
  assert.equal(findExplanationReview(material, original.id), review);
  assert.equal(isExplanationReview(phrase), false);
  assert.equal(isExplanationReview(question), false);
  const updated = { ...original, analysis: { explanationZh: 'A new analysis' } };
  assert.equal(explanationReviewText(updated, review, true), original.analysis.explanationZh);
  assert.equal(explanationReviewText(updated, review, false), 'A new analysis');
  assert.equal(explanationReviewText({ ...original, analysis: null }, review), original.analysis.explanationZh);
  assert.throws(() => createExplanationReview(original, ''), /尚未准备好/);
  assert.throws(() => createExplanationReview(original, '字'.repeat(5001)), /5000/);
});

test('saving only an explanation includes its original paragraph in review', () => {
  const review = createExplanationReview(original, original.analysis.explanationZh);
  const material = { id: 'material-synthetic', paragraphs: [{ id: 'paragraph-one', sentenceIds: [original.id] }], reviewItems: [review] };
  const queue = buildMaterialReviewQueue(material);
  assert.equal(queue.length, 1);
  assert.deepEqual(queue[0].review.sentenceIds, [original.id]);
  assert.deepEqual(queue[0].review.itemIds, [review.id]);
  material.reviewItems = [];
  assert.equal(buildMaterialReviewQueue(material).length, 0);
});

test('real local API persists explanation snapshots, deduplicates repeated saves, and removes only that review', { timeout: 30000 }, async context => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'listening-explanation-review-'));
  const materialId = 'material-explanation-synthetic';
  const directory = path.join(root, 'materials', materialId);
  await fs.mkdir(directory, { recursive: true });
  const material = {
    id: materialId, title: 'Synthetic explanation review', status: 'ready', analysisStatus: 'ready',
    sourceType: 'local', sentences: [original], duration: 5,
    paragraphs: [{ id: 'paragraph-one', sentenceIds: [original.id], start: 0, end: 5, text: original.text }],
    progress: { [original.id]: { dictation: 'Keep my dictation' } },
    reviewItems: [{ id: 'review-phrase', kind: 'phrase', sentenceId: original.id, sourceText: 'velvet tower', meaningZh: '绒布塔' }],
  };
  await fs.writeFile(path.join(directory, 'material.json'), JSON.stringify(material));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, PORT: String(port), LISTENING_DATA_DIR: root, SKIP_CODEX_ANALYSIS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(async () => {
    if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
    await fs.rm(root, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test server startup timed out')), 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.stdout.on('data', data => { if (String(data).includes('原声精听已启动')) { clearTimeout(timeout); resolve(); } });
  });
  const api = async (url, method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(response.status, 200);
    return response.json();
  };
  const note = `${original.analysis.explanationZh} ${'This longer note must remain complete. '.repeat(40)}`.trim();
  const review = createExplanationReview(original, note);
  const endpoint = `/api/materials/${materialId}/review-items`;
  await api(endpoint, 'POST', review);
  await api(endpoint, 'POST', review);
  const { material: saved } = await api(`/api/materials/${materialId}`);
  assert.equal(saved.reviewItems.length, 2, 'retry never creates duplicates');
  assert.equal(findExplanationReview(saved, original.id).answerZh, note, 'notes longer than 1000 characters are intact');
  assert.equal(findExplanationReview(saved, original.id).sourceText, original.text);
  assert.deepEqual(saved.progress, material.progress);
  assert.deepEqual(saved.sentences, material.sentences);
  const { items } = await api('/api/review-queue');
  assert.equal(items.length, 1);
  assert.ok(items[0].review.itemIds.includes(review.id));
  const disk = JSON.parse(await fs.readFile(path.join(directory, 'material.json'), 'utf8'));
  assert.equal(findExplanationReview(disk, original.id).answerZh, note);
  await api(`${endpoint}/${review.id}`, 'DELETE');
  const { material: removed } = await api(`/api/materials/${materialId}`);
  assert.equal(findExplanationReview(removed, original.id), undefined);
  assert.deepEqual(removed.reviewItems.map(item => item.id), ['review-phrase']);
  assert.equal((await api('/api/review-queue')).items.length, 1, 'independently saved phrase keeps the paragraph in review');
});

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}
