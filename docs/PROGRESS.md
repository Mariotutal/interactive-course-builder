# Progress

Status as of 2026-10-20: **implemented and verified, within the limits listed in `EVALUATION.md`.**

## Done

- Audit and extraction map (`docs/AUDIT.md`).
- Architecture decision (`docs/ARCHITECTURE.md`): a single Agent Skill, no MCP server.
- **Skill package** (`skills/interactive-course-builder/`):
  - `SKILL.md`;
  - 6 references;
  - runtime: app, 13 interaction patterns, safe expression evaluator, learner state (format 2, concept review), i18n in en and es, CSS;
  - templates: request, starter course, `function-lab` course-local sandbox;
  - CLI `lk.mjs` with `check-request`, `init`, `validate`, `build`, `coverage` and `serve`.
- **Learner intake, optional knowledge architecture, concept review with format 1 → 2 migration, one maths sandbox (`function-lab`), limited visual options with contrast validation.**
- **Evaluation harness** (`evaluation/`): four benchmarks, rubric, automatic metrics, report, pilot protocol. Manual scores are self-reviews.
- **Tests:** 94 automated tests, a widget-gallery fixture, browser tests, a headless Chrome `file://` render test.
- **Examples from fresh contexts:** statistics (complete), history (partial by design), Spanish A1 (partial by design).
- **Docs:** README (install, use, remove), adding-a-subject guide, evaluation.

## Pending (optional)

- Run a learner pilot (`evaluation/PILOT.md`) and get an independent rubric review of the benchmarks.

- Run the Claude Code discovery test after `claude` login (command in `EVALUATION.md`).
- Finish the pending lessons of the history and Spanish examples (see each `PROGRESS.md`). These are content tasks, not tool tasks.
- Test in Firefox and Safari and with a screen reader.
- UI strings for more languages (add to `lk-i18n.js`, or override per course with `course.ui`).

## Next exact step

Install the skill (`README.md` → Install), then ask Claude Code for a course on a new subject. Afterwards, check the report against `references/quality-rubric.md`.
