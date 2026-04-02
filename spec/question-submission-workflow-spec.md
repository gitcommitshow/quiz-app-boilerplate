# Content Workflow (Questions) Specification

**Status**: Draft  
**Version**: 0.3  
**Last updated**: 2026-03-30  
**Owners**: Repo admins/maintainers

## Problem statement

We want **content** changes to be reviewed safely and efficiently using a Git-based workflow (PRs), starting with **questions**. Reviewers must be able to validate UI rendering in the PR’s Vercel preview quickly via deep links.

## Goals

- Establish a generalized, future-proof content layout (e.g. `content/questions`, `content/lessons`, etc.)
- Authors add questions in PR-friendly Markdown files
- Each question change results in small, reviewable diffs (file-per-question)
- Repo admins approve by merging PRs
- CI validates question correctness (schema + semantic rules) and compiles questions into a runtime-consumable artifact
- CI provides reviewer-friendly Vercel preview links per changed question

## Future content types (out of scope details)

We anticipate additional content types (e.g. lessons/blogs) with different frontmatter requirements. This spec does not define their schemas yet; it only defines the **directory convention** that enables adding new formats without reorganizing later.

## Non-goals

- Moderation/auth for end-users (belongs in future iteration)
- Database-backed moderation/state
- Designing complex reviewer UI (GitHub PR review is the moderation surface)

## Source of truth & directory layout

Content types live under `content/<type>/...`. For **questions** (this spec), each question is a single Markdown file:

- `content/questions/<slug-or-name>.md`

**Single layout**: every question lives in that tree and follows the same file format and compile rules. There is no alternate directory, pipeline, or schema for “maintainer” vs “community” questions. Optional provenance in frontmatter (e.g. author) may be added later without splitting trees.

**Rule**: one file = one question.

## Question file format (Markdown + frontmatter)

### File type

- `*.md`

### Frontmatter (required)

Each question file MUST begin with YAML frontmatter.

Required keys:
- `id` (string): stable unique identifier (never changes once merged)
- `slug` (string): stable unique URL slug used by `/question/:slug`
- `type` (`objective` | `subjective`)
- `version` (integer, >= 1)
- `labels` (string array)
- `hints` (string array, length >= 2)
- `expectedAnswer` (string or multi-line)

Conditional keys:
- If `type: objective`:
  - `options` (string array, length >= 2)
  - `expectedAnswer` MUST match one of `options` **exactly**
- If `type: subjective`:
  - `keywords` (string array, can be empty)
  - `minKeywords` (integer, >= 0)
  - `maxLength` (integer, >= 0; `0` means “no limit”)

### Markdown body

After frontmatter, file body contains the question prompt in Markdown.

Support expectations:
- Markdown supported
- Mermaid supported via fenced code blocks (e.g. ```mermaid)

## Moderation model (Git PR-based)

- Authors submit by opening a PR that adds/updates files under `content/questions/**`.
- Repo admins approve by merging the PR into the main branch.
- Merged questions become part of the compiled runtime question set.

Optional (future): a `status: pending|approved|rejected` frontmatter field, but not required for the initial workflow.

## Build step: compiled questions artifact

### Output location

The build step generates a JSON artifact used by the frontend quiz, for example:
- `src/public/questions.json`

### Output schema

The compiled JSON MUST be an array of objects that match the runtime expectations of the current quiz logic:
- `id`
- `slug`
- `question` (renderable Markdown string)
- `type` (`objective` | `subjective`)
- `hints` (`string[]`)
- `version`
- `expectedAnswer`
- `labels`
- conditional fields:
  - objective: `options`
  - subjective: `keywords`, `minKeywords`, `maxLength`

### Determinism requirements

- Compilation MUST be deterministic (stable order, stable JSON formatting).
- Compilation MUST fail CI on schema validation errors.

## CI validation rules (must fail PR)

PRs modifying `content/questions/**` MUST fail CI if any of the following occur:
- Duplicate `id` across all compiled questions
- Duplicate `slug` across all compiled questions
- Missing required frontmatter fields
- `hints.length < 2`
- Objective question:
  - `options.length < 2`, or
  - `expectedAnswer` not exactly in `options`
- Subjective question:
  - `minKeywords < 0`, `maxLength < 0`, or non-integers
- `version < 1` or non-integer

## Reviewer preview links in PRs

### Desired reviewer experience

When a PR includes changes under `content/questions/**`, CI MUST add/update a PR comment that includes:
- The PR’s Vercel Preview “home” link
- For each changed question file, a per-question deep link formatted as:
  - `https://<vercel-preview>/question/<slug>`

This enables reviewers to click once and validate the UI in the real preview.

## Acceptance criteria

1. PRs adding/editing question files produce:
   - a successful compile step
   - CI validation feedback if invalid
   - PR comment(s) with preview deep links for each changed question
2. Review diffs are localized to `content/questions/**.md` files and are naturally small (no giant JSON-array edits).
3. The compiled artifact is deterministic so repeated builds do not create noisy diffs.

## Agent instructions (AI-authored questions)

We want to leverage AI agents to generate question content that conforms to this workflow.

### Instruction docs location

Agent instruction docs MUST live under:

- `content/_instructions/`

Questions-specific instructions MUST live under:

- `content/_instructions/questions.md`

### What the instruction doc must contain

The questions agent instruction doc MUST specify:

- Required frontmatter keys and validation rules from this spec
- Writing guidelines (clarity, scope, avoid ambiguity, hint quality/progression)
- Objective vs subjective patterns (when to choose each; how to craft options/expectedAnswer)
- Mermaid usage guidance (when appropriate; keep diagrams minimal and correct)
- Slug/id rules and uniqueness expectations
- Examples of a valid question file (at least one objective and one subjective)

## Open decisions

- Whether to commit the compiled artifact (`questions.json`) into git or generate it only in CI/build.

