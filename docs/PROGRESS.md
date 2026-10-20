# Progress

Status as of 2026-10-20: **implemented and verified, within the limits listed in `EVALUATION.md`.**

## Done

- Audit and extraction map (`docs/AUDIT.md`).
- Architecture decision (`docs/ARCHITECTURE.md`): a single Agent Skill, no MCP server.
- **Skill package** (`skills/interactive-course-builder/`):
  - `SKILL.md`;
  - 6 references;
  - runtime: app, 10 interaction patterns, safe expression evaluator, i18n in en and es, CSS;
  - templates: request, starter course;
  - CLI `lk.mjs` with `check-request`, `init`, `validate`, `build`, `coverage` and `serve`.
- **Tests:** 48 automated tests, a widget-gallery fixture, browser tests, a headless Chrome `file://` render test.
- **Examples from fresh contexts:** statistics (complete), history (partial by design), Spanish A1 (partial by design).
- **Docs:** README (install, use, remove), adding-a-subject guide, evaluation.

## Pending (optional)

- Run the Claude Code discovery test after `claude` login (command in `EVALUATION.md`).
- Finish the pending lessons of the history and Spanish examples (see each `PROGRESS.md`). These are content tasks, not tool tasks.
- Test in Firefox and Safari and with a screen reader.
- UI strings for more languages (add to `lk-i18n.js`, or override per course with `course.ui`).

## Next exact step

Install the skill (`README.md` → Install), then ask Claude Code for a course on a new subject. Afterwards, check the report against `references/quality-rubric.md`.
