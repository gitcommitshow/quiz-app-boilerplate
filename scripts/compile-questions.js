/**
 * Compiles all Markdown under content/questions into src/public/questions.json.
 * Order: stable sort by slug. Validates per spec/question-submission-workflow-spec.md.
 *
 * Body layout: prompt text, then ## Options (alphabet lines, checkbox list, or checkbox + alphabet), ## Expected answer, ## Hints.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(PROJECT_ROOT, 'src', 'public', 'questions.json');

/** Walk directory for .md files (no extra dependency). */
async function collectMarkdownFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return out;
    throw e;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await collectMarkdownFiles(full)));
    } else if (ent.isFile() && ent.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/** Normalize id for runtime: integer when numeric, else string. */
export function normalizeId(id) {
  if (typeof id === 'number' && Number.isInteger(id)) return id;
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return parseInt(id.trim(), 10);
  return String(id);
}

function isInt(n) {
  return typeof n === 'number' && Number.isInteger(n);
}

function require(cond, msg) {
  if (!cond) throw new Error(msg);
}

/**
 * Map ## heading text to internal key. Only known sections allowed.
 */
function normalizeSectionTitle(title) {
  const t = title.trim().toLowerCase();
  if (t === 'options' || t === 'option') return 'options';
  if (t === 'expected answer' || t === 'expectedanswer') return 'expectedAnswer';
  if (t === 'hints' || t === 'hint') return 'hints';
  throw new Error(`Unknown section heading "## ${title}" (use Options, Expected answer, or Hints)`);
}

/**
 * Split Markdown body into prompt (before first ##) and section name -> content.
 */
export function parseStructuredSections(body) {
  const text = body.replace(/\r\n/g, '\n');
  const re = /^##\s+(.+)$/gm;
  const matches = [...text.matchAll(re)];
  require(matches.length > 0, 'Body must include ## sections: Expected answer and Hints (and Options for objective questions)');

  const firstIdx = matches[0].index;
  const prompt = text.slice(0, firstIdx).trim();
  const sections = {};
  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const key = normalizeSectionTitle(title);
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections[key] = text.slice(start, end).trim();
  }
  return { prompt, sections };
}

/**
 * Parse objective ## Options. Supported styles (do not mix lettered vs plain inside checkbox lists):
 * 1) Alphabet: `A. text`, `B. text`, …
 * 2) Checkbox: `- [ ] text` / `- [x] text` (order = A, B, C… for expected answer)
 * 3) Checkbox + alphabet: `- [ ] A. text`, `- [ ] B. text`, …
 * Returns option **text only** (no letter prefix) for JSON.
 */
export function parseObjectiveOptions(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const first = normalized.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  require(first, 'objective: ## Options section is empty');
  if (/^\s*[-*]\s*\[/.test(first)) {
    return parseCheckboxOptions(normalized);
  }
  return parseAlphabeticOptions(normalized);
}

/**
 * Lines `A. text`, `B. text`, … (letters sequential from A). No leading list markers.
 */
export function parseAlphabeticOptions(text) {
  const lines = text.split('\n');
  const items = [];
  let current = null;
  const optStart = /^\s*([A-Za-z])\.\s+(.*)$/;
  for (const line of lines) {
    const m = line.match(optStart);
    if (m) {
      if (current !== null) items.push(current);
      const letter = m[1].toUpperCase();
      current = { letter, text: m[2].trim() };
    } else if (current !== null && line.trim() === '') {
      items.push(current);
      current = null;
    } else if (current !== null && /^\s+\S/.test(line)) {
      current.text += '\n' + line.trimEnd();
    }
  }
  if (current !== null) items.push(current);

  require(items.length >= 2, 'objective: need at least two options (A., B., …)');

  const result = [];
  for (let i = 0; i < items.length; i++) {
    const expectedLetter = String.fromCharCode(65 + i);
    require(
      items[i].letter === expectedLetter,
      `objective: options must be sequential starting at A. (expected ${expectedLetter}., got ${items[i].letter}.)`
    );
    const body = items[i].text.trim();
    require(body.length > 0, `objective: option ${expectedLetter} must have text after the letter`);
    result.push(body);
  }
  return result;
}

/**
 * GitHub-style task list: `- [ ] …` / `- [x] …` / `* [ ] …`. Optional `A. label` after the checkbox.
 */
export function parseCheckboxOptions(text) {
  const lines = text.split('\n');
  const rawBlocks = [];
  let current = null;
  const checkboxRe = /^(\s*)[-*]\s*\[\s*[xX ]?\s*\]\s*(.*)$/;
  for (const line of lines) {
    const m = line.match(checkboxRe);
    if (m) {
      if (current !== null) rawBlocks.push(current);
      current = m[2].trim();
    } else if (current !== null && line.trim() === '') {
      rawBlocks.push(current);
      current = null;
    } else if (current !== null && /^\s+\S/.test(line)) {
      current += '\n' + line.trimEnd();
    }
  }
  if (current !== null) rawBlocks.push(current);

  require(rawBlocks.length >= 2, 'objective: need at least two checkbox options (- [ ] …)');

  const parsed = rawBlocks.map((raw) => {
    const r = raw.trim();
    const lm = r.match(/^([A-Za-z])\.\s+([\s\S]+)$/);
    if (lm) {
      return { letter: lm[1].toUpperCase(), text: lm[2].trim() };
    }
    return { text: r };
  });

  const lettered = parsed.filter((p) => p.letter);
  if (lettered.length > 0) {
    require(
      lettered.length === parsed.length,
      'objective: checkbox options must all use "A. text" after [ ] or all be plain text (no mixing)'
    );
    const result = [];
    for (let i = 0; i < parsed.length; i++) {
      const expectedLetter = String.fromCharCode(65 + i);
      require(
        parsed[i].letter === expectedLetter,
        `objective: checkbox+letter options must be sequential A., B., … (expected ${expectedLetter}., got ${parsed[i].letter}.)`
      );
      require(parsed[i].text.length > 0, `objective: option ${expectedLetter} needs text after the letter`);
      result.push(parsed[i].text);
    }
    return result;
  }

  return parsed.map((p) => {
    require(p.text.length > 0, 'objective: each checkbox option must have non-empty text');
    return p.text;
  });
}

/**
 * First line of objective expected answer: `Letter. text`, optionally prefixed with a GitHub task item `- [ ]` / `- [x]`.
 * With `options`, a line may be bare option text (no `A.` prefix) if it equals exactly one option — natural for `- [x] full option text`.
 */
export function parseObjectiveExpectedAnswerLine(text, options) {
  let firstLine = text.trim().split(/\n/)[0].trim();
  const taskPrefix = /^\s*[-*]\s*\[\s*[xX ]?\s*\]\s+/;
  firstLine = firstLine.replace(taskPrefix, '');
  const m = firstLine.match(/^([A-Za-z])\.\s+(.+)$/);
  if (m) {
    return { letter: m[1].toUpperCase(), text: m[2].trim() };
  }
  if (Array.isArray(options) && options.length > 0) {
    const candidate = firstLine.trim();
    const indices = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i] === candidate) indices.push(i);
    }
    require(
      indices.length === 1,
      indices.length === 0
        ? 'objective: expected answer must be "Letter. text", "- [x] Letter. text", or option text matching exactly one option'
        : 'objective: expected answer matches more than one option (duplicate option text)'
    );
    const i = indices[0];
    return {
      letter: String.fromCharCode('A'.charCodeAt(0) + i),
      text: options[i],
    };
  }
  require(
    m,
    'objective: expected answer must be one line like "B. option text" or "- [x] B. option text" matching an option'
  );
}

/**
 * Parse bullet / numbered list items; supports multiline items (indented continuation).
 */
export function parseMarkdownListItems(text) {
  const lines = text.split('\n');
  const items = [];
  let current = null;
  const itemStart = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
  for (const line of lines) {
    const m = line.match(itemStart);
    if (m) {
      if (current !== null) items.push(current.trim());
      current = m[3];
    } else if (current !== null && line.trim() === '') {
      items.push(current.trim());
      current = null;
    } else if (current !== null && /^\s+\S/.test(line)) {
      current += '\n' + line.trimEnd();
    }
  }
  if (current !== null) items.push(current.trim());
  return items.filter((s) => s.length > 0);
}

/**
 * Parse and validate one file; returns runtime question object or throws.
 */
export function fileToQuestion(filePath, relPath, raw) {
  const { data: fm, content: body } = matter(raw);
  const errs = (m) => `${relPath}: ${m}`;

  require(fm && typeof fm === 'object', errs('missing frontmatter'));

  const id = normalizeId(fm.id);
  require(
    (typeof id === 'number' && id >= 0) || (typeof id === 'string' && id.length > 0),
    errs('invalid id')
  );

  require(typeof fm.slug === 'string' && fm.slug.trim(), errs('slug required'));
  const slug = fm.slug.trim();

  require(fm.type === 'objective' || fm.type === 'subjective', errs('type must be objective or subjective'));

  require(isInt(fm.version) && fm.version >= 1, errs('version must be integer >= 1'));

  require(Array.isArray(fm.labels), errs('labels must be an array'));
  const labels = fm.labels.map((x) => String(x));

  let sections;
  try {
    sections = parseStructuredSections(body);
  } catch (e) {
    throw new Error(errs(e.message));
  }

  const { prompt, sections: sec } = sections;
  require(prompt.length > 0, errs('question prompt (text before first ##) must be non-empty'));

  const hintsRaw = sec.hints;
  require(typeof hintsRaw === 'string' && hintsRaw.length > 0, errs('## Hints section required'));
  const hints = parseMarkdownListItems(hintsRaw);
  require(hints.length >= 2, errs('hints list must have at least 2 items'));

  let expectedAnswer = sec.expectedAnswer;
  require(typeof expectedAnswer === 'string' && expectedAnswer.trim(), errs('## Expected answer section required'));

  const base = {
    id,
    slug,
    question: prompt,
    type: fm.type,
    hints,
    version: fm.version,
    labels,
  };

  if (fm.type === 'objective') {
    const optionsRaw = sec.options;
    require(typeof optionsRaw === 'string' && optionsRaw.length > 0, errs('objective: ## Options section required'));
    let options;
    try {
      options = parseObjectiveOptions(optionsRaw);
    } catch (e) {
      throw new Error(errs(e.message));
    }
    let expectedLine;
    try {
      expectedLine = parseObjectiveExpectedAnswerLine(expectedAnswer, options);
    } catch (e) {
      throw new Error(errs(e.message));
    }
    const letterIndex = expectedLine.letter.charCodeAt(0) - 'A'.charCodeAt(0);
    require(
      letterIndex >= 0 && letterIndex < options.length,
      errs('objective: expected answer letter must refer to an option (A–Z within range)')
    );
    require(
      options[letterIndex] === expectedLine.text,
      errs('objective: text after the letter must match that option’s text (source review uses "B. …", JSON stores text only)')
    );
    return { ...base, options, expectedAnswer: options[letterIndex] };
  }

  expectedAnswer = expectedAnswer.trim();
  const baseWithAnswer = { ...base, expectedAnswer };

  require(
    sec.options === undefined || String(sec.options).trim() === '',
    errs('subjective: remove ## Options section')
  );

  require(Array.isArray(fm.keywords), errs('subjective: keywords must be array in frontmatter'));
  const keywords = fm.keywords.map((k) => String(k));
  require(isInt(fm.minKeywords) && fm.minKeywords >= 0, errs('subjective: minKeywords must be integer >= 0'));
  require(isInt(fm.maxLength) && fm.maxLength >= 0, errs('subjective: maxLength must be integer >= 0'));
  return {
    ...baseWithAnswer,
    keywords,
    minKeywords: fm.minKeywords,
    maxLength: fm.maxLength,
  };
}

/**
 * Load all questions from disk, validate uniqueness, return sorted array.
 */
export async function compileQuestions(projectRoot = PROJECT_ROOT) {
  const contentDir = path.join(projectRoot, 'content', 'questions');
  const files = await collectMarkdownFiles(contentDir);
  require(files.length > 0, `No .md files under ${path.relative(projectRoot, contentDir)}`);

  const parsed = [];
  for (const abs of files) {
    const rel = path.relative(projectRoot, abs);
    const raw = await fs.readFile(abs, 'utf8');
    const q = fileToQuestion(abs, rel, raw);
    parsed.push({ rel, q });
  }

  const byId = new Map();
  const bySlug = new Map();
  for (const { rel, q } of parsed) {
    const idKey = typeof q.id === 'number' ? q.id : String(q.id);
    if (byId.has(idKey)) {
      throw new Error(`Duplicate id "${q.id}" in ${rel} and ${byId.get(idKey)}`);
    }
    byId.set(idKey, rel);
    if (bySlug.has(q.slug)) {
      throw new Error(`Duplicate slug "${q.slug}" in ${rel} and ${bySlug.get(q.slug)}`);
    }
    bySlug.set(q.slug, rel);
  }

  parsed.sort((a, b) => a.q.slug.localeCompare(b.q.slug));
  return parsed.map((p) => p.q);
}

/**
 * Write questions.json with deterministic formatting.
 */
export async function writeQuestionsJson(questions, outPath = OUT_FILE) {
  const json = JSON.stringify(questions, null, 2) + '\n';
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, json, 'utf8');
}

async function main() {
  const questions = await compileQuestions();
  await writeQuestionsJson(questions);
  console.log(`Wrote ${questions.length} questions to ${path.relative(PROJECT_ROOT, OUT_FILE)}`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
