/**
 * Node built-in tests for question compile validation (see package.json "test").
 */
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import test from 'node:test';
import {
  compileQuestions,
  fileToQuestion,
  parseObjectiveExpectedAnswerLine,
  parseObjectiveOptions,
} from '../scripts/compile-questions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('compiles a valid fixture project', async () => {
  const root = path.join(__dirname, 'fixtures', 'compile-happy');
  const qs = await compileQuestions(root);
  assert.equal(qs.length, 1);
  assert.equal(qs[0].slug, 'fixture-happy-compile');
  assert.equal(qs[0].expectedAnswer, 'Yes');
});

test('fails on duplicate id across files', async () => {
  const root = path.join(__dirname, 'fixtures', 'compile-dup');
  await assert.rejects(() => compileQuestions(root), /Duplicate id/);
});

test('parseObjectiveOptions: checkbox-only task list', () => {
  const raw = `- [ ] One
- [ ] Two
- [ ] Three`;
  const opts = parseObjectiveOptions(raw);
  assert.deepEqual(opts, ['One', 'Two', 'Three']);
});

test('parseObjectiveOptions: checkbox with A. B. labels after checkbox', () => {
  const raw = `- [ ] A. Alpha
- [ ] B. Beta`;
  const opts = parseObjectiveOptions(raw);
  assert.deepEqual(opts, ['Alpha', 'Beta']);
});

test('parseObjectiveExpectedAnswerLine: optional - [ ] / - [x] prefix', () => {
  assert.deepEqual(parseObjectiveExpectedAnswerLine('- [x] B. Beta'), { letter: 'B', text: 'Beta' });
  assert.deepEqual(parseObjectiveExpectedAnswerLine('- [ ] A. Alpha'), { letter: 'A', text: 'Alpha' });
  assert.deepEqual(parseObjectiveExpectedAnswerLine('* [x] C. Gamma'), { letter: 'C', text: 'Gamma' });
});

test('parseObjectiveExpectedAnswerLine: - [x] with bare option text when options provided', () => {
  const opts = ['Alpha', 'Beta', 'Gamma'];
  assert.deepEqual(parseObjectiveExpectedAnswerLine('- [x] Gamma', opts), { letter: 'C', text: 'Gamma' });
  assert.deepEqual(parseObjectiveExpectedAnswerLine('Gamma', opts), { letter: 'C', text: 'Gamma' });
});

test('rejects objective expectedAnswer not in options', () => {
  const raw = `---
id: 1
slug: bad
type: objective
version: 1
labels: []
---

Prompt

## Options

A. A
B. B

## Expected answer

A. Wrong text

## Hints

- a
- b
`;
  assert.throws(() => fileToQuestion('', 'bad.md', raw), /text after the letter must match/);
});
