# Audit of the Proxmox course and extraction map

Date: 2026-10-20. Audited artifact: `Personal/curso-proxmox/`, a static HTML/CSS/JS app with 19 modules. Context: the conversation in which it was built, the original prompt (`prompt-curso-proxmox-2.md`), and the course's own `docs/CONTENT-SPEC.md`, `docs/BRIEF-AGENTES.md` and `ESTADO.md`.

## What was inspected, and how

- **Source:** `assets/js/app.js` (611 lines), 8 widget files (~940 lines), `scripts/validate.mjs`, `export-md.mjs`, `coverage.mjs`, `content/*.js` and all 19 module files.
- **Behavior:** the app was run in a Chromium browser pane over a local HTTP server during the build session (2026-10-19). Every module was rendered and exercised: every widget, predictions, progress, export/import, search, glossary, review, diagnostic, print view, a 375 px mobile layout, and both themes. See the test log in `curso-proxmox/ESTADO.md`.
- **Not inspectable:** any real learner outcome. Nobody has studied the course, so no claim below is evidence that a pattern improves learning. Patterns are judged against the stated requirements and established instructional-design principles.
- **Legend for the "Source" column:** **O** = observed in the implementation, **R** = stated requirement in the original prompt, **L** = learner-reported preference, **P** = proposed improvement (not in the course).

## Extraction map

| # | Observed pattern (where) | Source | Learning purpose | Specific to Proxmox or this learner | What generalizes | Improve rather than copy |
|---|---|---|---|---|---|---|
| 1 | Fixed 8-phase concept: problem → intuition + analogy limit → visual → technical → predict → guided + challenge → verify → recall + own-words (`CONTENT-SPEC.md`; `conceptHtml()` in `app.js`) | R, O | Activate a need, build a model, check it, practice, retrieve | "Problem from your homelab"; "verify & diagnose" assumes a technical system | The cycle as a set of required functions per lesson | Order was rigidly enforced for all 104 concepts. Make it a coverage rule with justified exemptions, not a fixed template. |
| 2 | Predict-before-reveal with per-option misconception feedback (`predict`, `wrong:{}` fields; `.q` UI) | R, O | Generate before reading; confront misconceptions | None | Fully | Answers are keyed by array index (`m01.c1.r0`), so regenerated content silently reuses stale answers. Use stable ids plus content hashes. |
| 3 | "Where the analogy breaks" box (`analogyLimit`) | R, O | Prevent over-extension of intuitive models | None | Fully | Optional for subjects where analogies are not natural (for example grammar). |
| 4 | Inline SVG with `<title>`/`<desc>` and a written textual description (`visual` field; SVG classes in `app.css`) | R, O | Show relations; non-visual alternative | Node classes are named host/guest/net/store | Themed SVG classes; a text equivalent required | Make `alt` a first-class required field instead of convention. Use neutral class names. Text overflow had to be auto-fitted at runtime (`fitSvgText`); keep that safeguard. |
| 5 | Six domain simulators (packet path, storage, resource planner, protection, diagnosis, architecture) plus three small ones (`widgets/*.js`) | R, O | Manipulate variables and see explained consequences | Entirely: the topology, the backends and the hardware are hard-coded | The interaction *patterns*: parameter explorer, evidence/diagnosis case, explained consequences, declared simplifications | Rebuild as declarative, data-driven patterns configured per course, plus an extension point for course-specific simulations. |
| 6 | "Model note" under every widget stating its simplifications | R, O | Prevent treating a model as a predictor | None | Fully | Make `assumptions` a required config field. |
| 7 | Evidence-based diagnosis case: choose tests, reveal evidence, pick a hypothesis, debrief efficiency (`diagnosis-cases.js`) | R, O | Reason from evidence; avoid premature conclusions | Simulated shell and Proxmox outputs | Evidence selection → hypothesis → reasoned debrief (also history sources, medicine, debugging) | Allow multiple defensible conclusions and rubric-based debriefs for interpretive subjects. |
| 8 | Command blocks labelled with where they run and how risky they are; outputs labelled as illustrative (`.cmd[data-scope][data-kind]`, `.output`) | R, O | Safety; honesty about fabricated outputs | Shell- and infrastructure-specific | "Label illustrative data vs real measurement" and "label risk of real-world practice" | Generalize to `data-nature` (illustrative / real / historical / model) and practice-safety notes. |
| 9 | Labs typed as read / simulation / reversible / destructive, with safety, success checks, failures and cleanup (`lab` schema) | R, O | Safe real practice with verification | Infrastructure labs | Hands-on practice with success criteria and external-feedback notes | Not every subject has labs. Use `practice` with a `setting` (in-app, offline, real-world) and an `externalFeedback` note when the browser cannot verify it. |
| 10 | Decision exercise per module with guidance and a model answer (`decision`) | R, O | Justify choices with evidence | Homelab decisions | Open tasks with rubric and model answer | Map to outcomes. Offer criteria checklists for self-assessment, labelled as self-assessed. |
| 11 | Module quiz with reasoned explanations; open questions with revealable answers | R, O | Retrieval and feedback | None | Fully | Not mapped to outcomes; no transfer item distinct from rehearsed examples. Add `assesses: [outcomeIds]` and a required transfer task per lesson. |
| 12 | Contextual glossary popovers (`.gt[data-t]`), keyboard-accessible; glossary page with filter | R, O | Define terms before use | Spanish UI strings | Fully | Duplicates were resolved first-wins silently (16 duplicates). The validator should report conflicts. |
| 13 | Progress in localStorage; export/import JSON; notes to Markdown; storage warning (`app.js` state `pvecurso.v1`) | R, O | Learner ownership of data | Key name | Fully | "Studied" was a self-reported click, conflated with progress. Separate visited, attempted, self-rated confidence and demonstrated performance. Version the state and check `courseId` on import. |
| 14 | Spaced review at 1/3/7/21/60 days and cumulative review drawn from completed modules (`pageReview`) | R, O | Retrieval spaced over time | None | Fully | Make intervals configurable; draw review items with stable ids. |
| 15 | Optional diagnostic with a "start from zero" path that changes pace, not content | R, O | Calibrate the route | Questions are Proxmox-specific | Mechanism | Store the diagnostic in course data and map it to lessons. |
| 16 | Essential vs advanced route, with complete content in both (`route`, `level`) | R, O | Beginner path plus substantive depth | Labels | Fully | Routes as explicit lesson lists. |
| 17 | 30–45 minute sessions; long labs flagged; agenda table (`sessions`) | R, L | Fit real study time | Durations | Fully | Derive from the learner's `sessionMinutes` input instead of a fixed range. |
| 18 | Course map SVG built from prerequisites (`courseMapSvg`) | R, O | See structure and dependencies | None | Fully | Lesson-level prerequisites plus outcome map. |
| 19 | Search over modules, concepts, labs and glossary (`buildIndex`) | R, O | Retrieval and navigation | None | Fully | Keep. |
| 20 | Print view with solutions expanded; Markdown export generated from the single source (`#/imprimir`, `export-md.mjs`) | R, O | Offline and alternative format | None | Fully | Keep. |
| 21 | Content as JS template literals loaded with `document.write` so it works over `file://` | O | Offline without a server | None | Offline-first delivery | Escaping pitfalls appeared (`\t`, the dollar-brace sequence, unescaped `<` in `pre`). Author JSON and build one `content.js` bundle instead. |
| 22 | Validator that enforces the content contract (`validate.mjs`) | O | Quality gate | Field names | Fully | Regex-based HTML checks; also enforce outcome coverage, stable ids, the text alternative for each visual, and no `<script>`/inline handlers in content. |
| 23 | Version and source-freshness discipline: target version, access date, official / practical / pedagogical source labels (`VERSIONES.md`, `refs.kind`) | R, O | Honesty and currency | Proxmox versions | Fully | Generalize the source kinds: primary, secondary, official, research, reference, pedagogical. Add a jurisdiction/version field. |
| 24 | Learner context injected throughout (Dell, NUC, NAS, his services); unknowns stated as editable assumptions (`course.js hardware`, the assumptions in the planner) | R, L | Personal relevance without inventing facts | Entirely personal | "Unknowns are explicit, editable assumptions" | Personalization must be per-course input, never part of the reusable core. |
| 25 | Parallel authoring by agents under a written brief, then integration review (cross-references, links, render checks) (`BRIEF-AGENTES.md`) | O | Scale authoring | None | Staged authoring workflow with a brief and validation | Agents wrote 13–19k words per module. Length is not depth, so the brief should cap length and require outcome mapping. Cross-module references broke 11 times: generate them from ids. |
| 26 | Visual/interactive preference applied to every module | L | Engagement | Learner-reported | As a configurable preference | Treat it as a preference, not a learning-style category. Interactions must require thinking. |

## Requirements that the course did not fully meet (inputs for the reusable tool)

- **No outcome-to-assessment mapping.** Objectives exist but are not linked to questions.
- **No distinction between confidence and demonstrated performance.**
- **Stale answers after edits.** Answers keyed by array index are reused silently.
- **Hard-coded UI language** (Spanish strings in `app.js`).
- **Not tested over `file://`** in a real browser (only over HTTP), as admitted in `ESTADO.md`.
- **No reduced-motion handling.** There was little animation, so the impact is low, but it is not handled.
- **Advanced routes exist, but transfer was weak.** Decision exercises reused the same homelab scenario. A transfer task should change the context.

## Conclusion for the design

The reusable value is:

1. The lesson-function contract (items 1–3, 10–11), enforced by a validator.
2. A small set of declarative interaction patterns (items 5–7), with declared assumptions.
3. The learner-state model (items 13–14), improved.
4. The offline single-source delivery pipeline (items 19–22).
5. The evidence discipline (item 23).

Everything about Proxmox, the homelab and this particular learner stays out of the core.
