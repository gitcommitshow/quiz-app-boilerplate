/**
 * Builds `content/questions/<slug>.md` Markdown that satisfies `scripts/compile-questions.js`
 * validation (frontmatter + ## Options / ## Expected answer / ## Hints).
 */
import { stringify } from 'yaml';

/** URL slug: lowercase letters, digits, single hyphens between segments. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Returns true if `s` is a valid question file slug (kebab-case).
 */
export function isValidSlug(s) {
  return typeof s === 'string' && s.length >= 1 && s.length <= 120 && SLUG_PATTERN.test(s.trim());
}

/**
 * Escapes a string for safe use as a single-line YAML double-quoted value if needed.
 * `stringify` from `yaml` handles objects; we pass plain values and let YAML encode.
 */
function formatHintsSection(hints) {
  return hints
    .map((h) => {
      const t = String(h).trim();
      return `- ${t}`;
    })
    .join('\n');
}

/**
 * @param {object} params
 * @param {number|string} params.id - Stable question id (matches frontmatter `id`)
 * @param {string} params.slug - URL slug (filename stem)
 * @param {'objective'|'subjective'} params.type
 * @param {string} params.question - Prompt (Markdown body before first ##)
 * @param {string[]} params.hints - At least 2 hints
 * @param {string[]} [params.labels]
 * @param {number} [params.version=1]
 * @param {string[]} [params.options] - Objective only
 * @param {string} [params.expectedAnswer] - Objective: must match one option exactly; subjective: reference answer
 * @param {string[]} [params.keywords] - Subjective only
 * @param {number} [params.minKeywords] - Subjective only
 * @param {number} [params.maxLength] - Subjective only
 * @returns {string} Full .md file contents
 */
export function buildContributorMarkdown(params) {
  const {
    id,
    slug,
    type,
    question,
    hints,
    labels = [],
    version = 1,
    options,
    expectedAnswer,
    keywords,
    minKeywords = 0,
    maxLength = 0,
  } = params;

  if (!isValidSlug(slug)) {
    throw new Error('Invalid slug: use lowercase letters, digits, and hyphens (e.g. my-question-title)');
  }
  if (!Array.isArray(hints) || hints.length < 2) {
    throw new Error('At least two hints are required');
  }

  const fm = {
    id,
    slug: slug.trim(),
    type,
    version,
    labels: Array.isArray(labels) ? labels.map((x) => String(x)) : [],
  };

  let body = String(question).replace(/\r\n/g, '\n').trimEnd() + '\n';

  if (type === 'objective') {
    if (!Array.isArray(options) || options.length < 2) {
      throw new Error('Objective questions need at least two options');
    }
    const exp = String(expectedAnswer).trim();
    const idx = options.findIndex((o) => String(o).trim() === exp);
    if (idx < 0) {
      throw new Error('Expected answer must match one of the options exactly');
    }
    const letter = String.fromCharCode(65 + idx);
    const optionsBlock = options
      .map((opt, i) => {
        const L = String.fromCharCode(65 + i);
        const text = String(opt).trim();
        const lines = text.split('\n');
        const first = `${L}. ${lines[0]}`;
        const rest = lines.slice(1).map((line) => (line.trim() === '' ? '' : `   ${line}`));
        return [first, ...rest].filter(Boolean).join('\n');
      })
      .join('\n');

    body += `\n## Options\n\n${optionsBlock}\n\n## Expected answer\n\n${letter}. ${String(options[idx]).trim()}\n\n## Hints\n\n${formatHintsSection(hints)}\n`;
  } else {
    fm.keywords = Array.isArray(keywords) ? keywords.map((k) => String(k)) : [];
    fm.minKeywords = Number.isInteger(minKeywords) && minKeywords >= 0 ? minKeywords : 0;
    fm.maxLength = Number.isInteger(maxLength) && maxLength >= 0 ? maxLength : 0;

    body += `\n## Expected answer\n\n${String(expectedAnswer).trim()}\n\n## Hints\n\n${formatHintsSection(hints)}\n`;
  }

  const yamlBlock = stringify(fm, { lineWidth: 120 }).trimEnd();
  return `---\n${yamlBlock}\n---\n\n${body}`;
}

/**
 * Suggested filename for a contributor PR (`content/questions/<slug>.md`).
 */
export function markdownFilename(slug) {
  return `${String(slug).trim()}.md`;
}
