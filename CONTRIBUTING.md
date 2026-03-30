# Contributing

## Questions (content)

Questions are **Markdown files with YAML frontmatter**, not ad-hoc JSON. The runtime quiz reads a compiled artifact generated at build time.

**Workflow**

1. Fork the repository and create a branch.
2. Add or edit a Markdown file under `content/questions/` (one file per question). Put metadata in YAML frontmatter; put the prompt, **Options** / **Expected answer** / **Hints** in structured Markdown sections (see `docs/contributing-questions.md`).
3. Run `npm run compile:questions` (or `npm run build`); this regenerates `src/public/questions.json` and validates your changes.
4. Commit both the `.md` source(s) and the updated `src/public/questions.json`.
5. Open a pull request for review.

Validation and schema rules are documented in [docs/contributing-questions.md](docs/contributing-questions.md). That includes what to put in frontmatter, how objective vs subjective questions differ, and how to use Mermaid in the prompt body.

Question **compile** unit tests and fixtures live under [`test/`](test/) — run `npm test` before opening a PR if you change `scripts/compile-questions.js` or question format rules.
