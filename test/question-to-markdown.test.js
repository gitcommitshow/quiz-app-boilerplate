/**
 * Round-trip: generated Markdown must pass compile-time validation (fileToQuestion).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContributorMarkdown } from '../server/lib/questionToMarkdown.js';
import { fileToQuestion } from '../scripts/compile-questions.js';

test('buildContributorMarkdown objective round-trips through fileToQuestion', () => {
  const md = buildContributorMarkdown({
    id: 888001,
    slug: 'ui-gen-objective',
    type: 'objective',
    version: 1,
    labels: ['sql'],
    question: 'Pick the best answer.',
    options: ['A', 'B', 'C'],
    expectedAnswer: 'B',
    hints: ['First hint.', 'Second hint.'],
  });
  const q = fileToQuestion('', 'ui-gen-objective.md', md);
  assert.equal(q.slug, 'ui-gen-objective');
  assert.equal(q.type, 'objective');
  assert.deepEqual(q.options, ['A', 'B', 'C']);
  assert.equal(q.expectedAnswer, 'B');
});

test('buildContributorMarkdown subjective round-trips through fileToQuestion', () => {
  const md = buildContributorMarkdown({
    id: 'sub-1',
    slug: 'ui-gen-subjective',
    type: 'subjective',
    version: 1,
    labels: [],
    question: 'Explain normalization.',
    expectedAnswer: 'A concise explanation.',
    hints: ['Think relations.', 'Reduce redundancy.'],
    keywords: ['normalization'],
    minKeywords: 1,
    maxLength: 500,
  });
  const q = fileToQuestion('', 'ui-gen-subjective.md', md);
  assert.equal(q.slug, 'ui-gen-subjective');
  assert.equal(q.type, 'subjective');
  assert.equal(q.expectedAnswer, 'A concise explanation.');
  assert.deepEqual(q.keywords, ['normalization']);
});
