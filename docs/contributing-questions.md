# Contributing quiz questions

This document matches the [question submission workflow spec](../spec/question-submission-workflow-spec.md) and the checks enforced by `npm run compile:questions`.

## File layout

- **One file = one question** (`*.md`).
- Place files directly under `content/questions/` (not in subfolders).
- **YAML frontmatter** holds metadata only (`id`, `slug`, `type`, `version`, `labels`, and for subjective: `keywords`, `minKeywords`, `maxLength`).
- **Markdown body** has two parts:
  1. **Prompt** — everything before the first `##` heading: the question text (Markdown and Mermaid supported).
  2. **Structured sections** — `## Options` (objective only), `## Expected answer`, and `## Hints` (headings are case-insensitive; use these exact titles).

`options`, **expected answer**, and **hints** support Markdown (e.g. `` `code` ``, `**bold**`); list items are parsed as plain strings for matching, and the app renders hints and option labels with inline Markdown.

**Compiled `questions.json`**: objective `options` and `expectedAnswer` store **text only** (no `A.` / `B.` prefixes). Letters appear in the source `.md` for review; the UI adds `A.`, `B.`, … when displaying choices.

## Required frontmatter

Every file must start with YAML frontmatter between `---` lines.

| Field | Required | Notes |
|--------|----------|--------|
| `id` | yes | Stable unique identifier (string or number in YAML; numeric IDs stay numeric in the compiled JSON). Never change after merge. |
| `slug` | yes | Stable URL segment for `/question/:slug`. Unique across all questions. |
| `type` | yes | `objective` or `subjective` |
| `version` | yes | Integer ≥ 1 |
| `labels` | yes | String array (may be empty `[]`) |

### Objective (`type: objective`)

Frontmatter only — no `keywords`. Body must include `## Options`, `## Expected answer`, and `## Hints`.

### Subjective (`type: subjective`)

Also in frontmatter:

- `keywords` — string array (may be empty)
- `minKeywords` — integer ≥ 0
- `maxLength` — integer ≥ 0 (`0` means no limit)

Body must **not** include `## Options`. Include `## Expected answer` and `## Hints`.

## Body sections

Use level-2 headings exactly like this (spacing/case can match the patterns below):

| Section | Objective | Subjective |
|---------|-----------|------------|
| `## Options` | Required: use **one** of the supported styles below (do not mix styles in the same section) | Omit |
| `## Expected answer` | Required: **one line**. Use `Letter. text` (letter = choice index); text must match that option in the compiled JSON. You may prefix with `- [ ]` / `- [x]`. After `- [x]` you may repeat **either** `C. …` **or** the option text alone (must match exactly one option). | Required: reference answer (can be multi-line) |
| `## Hints` | Required: at least two list items (`-` / `*` / `1.`) | Required: at least two list items |

**Objective `## Options`** — pick one style (all render on GitHub; use checkboxes for familiar task-list editing):

1. **Alphabet only** — lines start with `A.` … `B.` … (no `-` / checkbox):

```markdown
A. First choice
B. Second choice
```

2. **Checkbox only** — GitHub task list; order is first → A, second → B, …:

```markdown
- [ ] First choice
- [ ] Second choice
```

3. **Checkbox + alphabet** — checkbox then `A.` / `B.` label (good for review):

```markdown
- [ ] A. First choice
- [ ] B. Second choice
```

Do **not** mix “letter after checkbox” on some lines and plain text on others. Checked vs unchecked (`[ ]` / `[x]`) is ignored by the compiler.

**Objective expected answer** is always one line like `B. Second choice` (letter + text matching that option’s stored text).

**Hints** (bullet list example):

```markdown
- first hint
- second hint
```

## CI validation (must pass)

The compiler fails if any of the following occur:

- Duplicate `id` or `slug` across all question files
- Missing or unknown `##` section titles
- Missing frontmatter fields or wrong types
- Fewer than two hint list items
- Objective: fewer than two options, invalid alphabetic sequence, mixed checkbox letter/plain rows, or expected answer line not matching one option’s text at that letter
- Subjective: `minKeywords` / `maxLength` not integers or `< 0`
- `version < 1` or not an integer

## Writing guidelines

- Keep scope clear for a quiz setting; avoid ambiguous wording.
- **Hints** should progress from gentle nudge toward the solution.
- Use **Mermaid** only when a diagram clarifies the prompt; keep diagrams small and valid.

## When to use objective vs subjective

- **Objective**: a single correct choice among explicit options. Craft distractors that are plausible but clearly wrong when the concept is understood.
- **Subjective**: open-ended answers (SQL, explanations). Prefer concrete `keywords` and `minKeywords` that reflect important concepts.

## Slug and id rules

- **Slug**: URL-safe, stable, unique (e.g. `sql-join-basics`). Do not reuse after merge.
- **Id**: unique across all questions; never change once published (learners and storage may reference it).

## Examples

### Objective (minimal)

```markdown
---
id: "example-obj-1"
slug: example-objective-sample
type: objective
version: 1
labels: [sql]
---

Which keyword filters rows before aggregation?

## Options

A. WHERE
B. HAVING
C. GROUP BY

## Expected answer

A. WHERE

## Hints

- Clauses that restrict rows **before** aggregation live in a familiar place near `FROM`.
- It is not `HAVING`; that applies **after** groups exist.
```

### Subjective (minimal)

```markdown
---
id: "example-sub-1"
slug: example-subjective-sample
type: subjective
version: 1
labels: [sql]
keywords: [UNION, columns, types]
minKeywords: 2
maxLength: 400
---

Explain what must be true for two `SELECT` results to be combined with `UNION`.

## Expected answer

Same column count and compatible types.

## Hints

- Think about set operations.
- Two relations must be union-compatible.
```

## Build

Run `npm run compile:questions` before committing; CI runs the same step on pull requests that touch question content.
