# Generalization evaluation and test evidence

Date: 2026-10-20. Package: `interactive-course-builder` 1.0.0 (course format 1; learner state format 2).

## How the examples were produced

Each example was authored by a separate agent (Claude Sonnet) **in a fresh context**:

- Its only inputs were the path to the skill package and a learning request with a **synthetic** learner profile.
- It was told not to open the original Proxmox course or this `docs/` folder.
- It followed `SKILL.md` and the references, ran the CLI, and reported back what was unclear.

The agents were invoked by path. This approximates "a fresh session with only the package". It is not a test of Claude Code's automatic skill discovery; see Limitations.

## Coverage matrix

| | Statistics (es) | Historical sources (en) | Spanish A1 (en UI, es target) |
|---|---|---|---|
| Kind of subject | Quantitative | Interpretive, evidence-based argument | Human communication, language |
| Course language | Spanish (`es-ES`), Spanish UI | English | English UI; content `lang="es-ES"` |
| Scope delivered | **Complete end-to-end mini-course:** 3 modules, 6 core + 1 advanced lesson, ≈ 3.5 h | Curriculum of 2 modules: **2 complete lessons** (≈ 1.5 h); 4 lessons pending in `PROGRESS.md` | Curriculum of 2 modules: **2 complete lessons** (≈ 40 min); 5 lessons pending in `PROGRESS.md` |
| Outcomes → taught → assessed | 6 → all taught and assessed | 3 → all | 4 → all |
| Prerequisite path | distributions → sampling distribution → CI construction → interpretation → margins of error → A/B tests → advanced | sourcing → corroboration | ordering → bill / tú-usted |
| Activity patterns | parameter-explorer ×6, **custom `sampling-sim` ×3**, classify ×3, stepper, evidence-case | source-compare, timeline (established, contested and uncertain items), evidence-case with several *defensible* conclusions, classify | dialogue ×2 (speech synthesis optional), cloze ×2, classify |
| Assessment types | 21 MCQ with misconception feedback, 6 numeric with tolerance, 1 multi, 7 open with rubric | 6 MCQ, 2 open; capstone argument rubric (human judgment stated) | 8 MCQ, 1 numeric, 2 open; 2 **real-world** practices with external feedback (speaking with a friend) |
| Transfer tasks | 7 (one per lesson) plus capstone | 2 plus capstone | 2 plus capstone (role-play) |
| Diagnostic | 5 questions | 3 | 2 |
| Sources | NIST/SEMATECH e-Handbook, OpenIntro IMS, Pew Research (33 entries) | MHS transcriptions, the Boston-Gazette, the Revere engraving page, Gilder Lehrman (11) | Wikipedia, used as secondary because RAE, CEFR and Cervantes returned 403 or maintenance pages (8). Unverified claims are labelled "course decision" |
| Exemptions | none | none | `worked` in one lesson (the agent itself judged its reason thin) |
| Core edited for this subject? | **No.** The simulation is a course-local widget. | No | No |

The core *was* changed during the evaluation. The changes are the generic fixes listed below, and all three examples were rebuilt and revalidated afterwards. No change was subject-specific.

## Rubric review

This is a manual review by the package author based on spot checks. It is not evidence of learning effectiveness. Scores are 0–2 per `references/quality-rubric.md`.

| Criterion | Statistics | History | Spanish A1 | Notes |
|---|---|---|---|---|
| Accuracy | 2 | 1 | 1 | **Statistics:** I reran t quantiles and cdf (2.262 at 9 df, 2.045 at 29 df) against tabulated values, and the CI interpretation follows NIST. **History:** all 13 quotations checked appear verbatim in the raw HTML of the cited pages (only difference: a line-break hyphen in the MHS print); recognized scholarship is missing. **Spanish:** the authoritative sources could not be fetched, so it relies on secondary sources and labelled course decisions. |
| Prerequisite clarity | 2 | 2 | 2 | Explicit chains; the validator enforces the order. |
| Depth | 2 | 2 | 1 | Spanish is intro-level and short by request; it has two lessons only. |
| Interaction quality | 2 | 2 | 2 | All controls were exercised; see the tests below. |
| Feedback | 2 | 2 | 2 | Per-option misconception feedback. History allows several defensible verdicts. One numeric question in each of statistics and Spanish lacks `feedbackWrong`; the new warning flags it. |
| Accessibility | 2 | 2 | 2 | Text equivalents, keyboard operation, `lang` attributes, no overflow at 375 px. Not tested with a screen reader. |
| Transfer | 2 | 2 | 2 | Transfer tasks change the context (for example a festival claim, a different poll, a different café exchange). |
| Usability | 2 | 1 | 1 | History and Spanish are partial by design. Their `PROGRESS.md` gives the next exact step. |

## Test evidence

### Automated

`node tests/run-tests.mjs`: **97 passed, 0 failed**. The suite covers:

- **Expression evaluator:** precedence, stats and t functions, rejection of code-like input.
- **Request normalization:** blocking gaps, defaults, invalid values.
- **Validator:** 18 accepted and rejected mutations, including unsafe HTML, placeholders, the Spanish "todo" regression, outcome coverage, bad expressions, dangling scenario nodes, duplicate ids and custom-widget detection.
- **Build:** output files, stable content hashes, a new hash only for a changed question, refusal to build an invalid course.
- **`init`:** no placeholder lessons, refusal to overwrite.
- **Request gating:** `check-request` exits with status 1 and `init` creates nothing when the topic or goals are missing.
- **Lesson profiles:** a `focused` lesson validates with only motivate, explain, check and sources; the same lesson fails under `full`; an outcome with no transfer task anywhere produces a course-level warning.
- **Routes and languages:** a missing route produces only a warning (the advanced route is optional). A course language without built-in UI strings warns in `check-request` and `validate`. Markdown headings follow the course language.
- **Security regressions (second review):**
  - `build` refuses an output folder that is the course folder, one of its parents, a source subfolder, or an unrelated non-empty folder, and the source survives;
  - Markdown and coverage output stay inside the course;
  - entity-encoded and obfuscated executable URLs are rejected (`jav&#x61;script:`, `&#106` without a semicolon, `&Tab;`/`&colon;`, newline-split schemes, SVG `xlink:href` with `data:text/html`, SVG `<animate>` on href, `vbscript:`, CSS `url()`), while normal https, fragment, relative and `data:image` URLs pass.
- **Learner state format 2:** clean/reject malformed state, format 1 → 2 migration with concept backfill, expanding review intervals (success advances, failure resets, the last interval ends scheduling), due-concept selection.
- **Knowledge architecture (optional):** the concepts fixture validates with no warnings; prerequisite cycles, unknown concept tags, hubs with fewer than two concepts, dispositions with fewer than two bands and auto-scored dispositions are rejected or warned; a course without it is unaffected; the coverage report gains a knowledge table.
- **Intake:** invalid values are rejected; decisions are derived and stored by `init`.
- **Visual options:** unknown keys warn; token pairs below WCAG AA 4.5:1 against the light or dark background are errors.
- **function-lab sandbox:** failing `testCases` are build errors; the widget is copied into the build.
- **Evaluation harness:** `auto` metrics, the manual template, `report`, and `pilot` rejecting exports from another course.
- **Export and validator details:** code in question prompts survives the Markdown export; questions with `type` instead of `kind` are errors; citation labels that do not match the source position warn; lessons that add up to much more than the requested total time warn; a full lesson whose first prediction follows its first explanation warns. A lesson below the depth floor (about 25 words of learner-facing prose per declared minute for `full`, 10 for `focused`, after crediting time spent in activities) warns. Words are counted with `Intl.Segmenter` in the course language, so Chinese or Japanese text is not counted as one word per paragraph; on the existing courses it flags none of the benchmarks or examples and all 16 lessons of a deliberately checked course that averaged about 420 words per 45-minute session.
- **Package hygiene:** the frontmatter keys are limited to the strict set accepted by the stricter skill validators (`name`, `description`, `license`, `allowed-tools`, `metadata`). `quick_validate.py` from the `skill-creator` plugin reports the skill as valid. No personal or original-course terms appear in the package.

### Browser (Chromium pane, served over local HTTP)

- **Widget gallery fixture** (`tests/fixtures/widget-gallery`): the original 10 built-in patterns were driven by script. Every one produced the expected feedback and recorded an attempt:
  - evidence-case: verdict, plus the list of unexamined key evidence;
  - scenario: branching path, restart;
  - classify: per-item feedback;
  - timeline: detail view, tag filter, contested label, ordering check;
  - source-compare: answer saved;
  - dialogue: translation toggle, comprehension misconception, accent-insensitive production;
  - cloze: correct and incorrect marking;
  - hotspot-diagram: highlight, find-it quiz right and wrong;
  - stepper: predict gate locks and unlocks;
  - code-trace: code line and state change render together; a prediction gate locks the next state;
  - system-flow: active components and their explanation render at each lifecycle step;
  - causal-map: selecting the supported relationship reveals its explanation and feedback.
  - parameter-explorer: outputs, two-series chart.
- **Starter course:**
  - First-attempt performance is kept after a retry.
  - Visited, attempted, self-rated confidence and written responses are tracked separately.
  - Changing one question and rebuilding discards only that answer and shows a notice; other answers are kept.
  - Export JSON and notes to Markdown work.
  - A valid import works; an import from another course is refused.
  - The glossary popover opens with Enter, Escape closes it, and focus returns to the term.
  - Map, routes, diagnostic, review, print view and search render.
- **Examples:**
  - Every lesson and general page renders, with no widget failures.
  - No horizontal overflow at 375 × 812, after fixing long-title overflow in the top bar.
  - The Spanish UI and Spanish number formatting (`4,00`) work.
  - The custom `sampling-sim` runs (100 samples → coverage count announced via `aria-live`; misses marked with ✗ and a dashed line, not only color).
  - Dialogue lines carry `lang="es-ES"`.

### Headless Chrome over `file://`

Run with Google Chrome `--headless=new --dump-dom`. Opening `site/index.html` directly renders full lessons with widgets and no errors for the statistics and history examples. The original Proxmox course was checked the same way, which closes a limitation recorded in that course's `ESTADO.md`. Only rendering was checked under `file://`; `localStorage` persistence there was not.

## Learner model, intake, knowledge architecture, sandbox and visual options

Checked in the browser pane on the `tests/fixtures/concepts-lab` course (served over local HTTP):

- Intake decisions appear on the home page. Theme attributes are applied, and token colours switch by mode: light `#5b3f9e`, dark `#c9b6ff`.
- Visiting a lesson introduces its concepts. A correct first attempt moves a concept to step 1, due in 3 days; a wrong one keeps it at step 0, due in 1 day. A review answer on a due concept moves it to step 2, due in 7 days, and leaves the lesson item's answer untouched.
- A stored format 1 state shows the migration notice, keeps the answers and backfills concepts.
- function-lab: the slider stays locked until the learner predicts, then unlocks and gives feedback. Moving the slider down is judged correctly.
- No horizontal overflow at 375 px on 9 pages.

## Benchmark harness

`evaluation/` holds four fixed benchmark requests (mathematics, Kubernetes, programming, social science in Spanish), the courses fresh agents generated from them using only the skill, a 7-criterion rubric, and `lk-eval.mjs`. Results are in `evaluation/RESULTS.md`. The manual scores there are **self-reviews** by a model of the same family as the generator, not independent evidence. `evaluation/PILOT.md` describes how to run a pilot with real learners; none has been run.

Findings from the first round (self-review scores 8, 8, 9 and 11 out of 14):

- **All four courses scored 1 on instructional sequencing**, for the same reason: predictions placed after the explanation, or after a visual or worked example that gives the answer away. The cause was in the skill: `lesson-contract.md` listed the usual order as explain → worked → predict. The guidance now puts the first prediction before the first explanation, and `validate` warns when a full lesson does not. Before the fix, no benchmark course had a validator warning for this; after it, the social-science course has 3. A prediction given away by an earlier visual or text equivalent, as in mathematics, cannot be detected automatically.
- Other recurring problems that the validator cannot catch: terms used before they are defined; transfer tasks that reuse the context of the lesson's own examples; classify feedback that confirms the right answer without naming the misconception behind a wrong one; sources that are many anchors on two pages.
- The existing examples (`examples/`) predate this rule and now show the warning (statistics 7, history 2, Spanish 2). They were not reordered, because moving a prediction can break the lesson's flow and needs content review.

## Generic fixes made because of the evaluation

| Fix | Found by |
|---|---|
| Placeholder detector flagged Spanish "todo" and "método" (ASCII `\b`, case-insensitive). Now case-sensitive with Unicode boundaries; regression test added. | Statistics agent |
| Numbers in built-in widgets now follow the course locale; `api.fmt` added for custom widgets. | Statistics agent |
| `tcdf` and `tinv` (Student t) added to the safe evaluator, with tests. | Statistics agent |
| Source `status: "unverified"`, shown in the app and listed in `COVERAGE.md`. Guidance for blocked archives, for verifying exact quotes from raw text, and for link-only archive images. | History and Spanish agents |
| `serve` command, for preview tools that snapshot `file://`. | History agent |
| Warning when a lesson is much longer than the learner's session length; warning for numeric questions without misconception feedback. | Spanish and statistics agents |
| Long course titles overflowed the mobile top bar. | Browser test |
| Review fixes: `check-request` and `init` fail on blocking gaps; advanced route made optional and stated the same way in SKILL.md, the references, the template and the validator; interface-language limit stated in the skill description, with warnings and localized Markdown; `full`/`focused` lesson profiles with a course-level transfer rule; `compatibility` moved out of the frontmatter. | Review by the user |
| Second review: `build --out` could delete the course (and wrote `markdown/` next to `--out`, deleting a sibling folder); the HTML filter missed entity-encoded `javascript:` URLs; importing `items: null` left the course unusable. Fixed with output-folder guards plus a `.lk-build` marker, an entity-decoding URL allow-list plus a render-time sanitizer, and field-by-field validation of imported and stored state. Verified by tests and in the browser: rejected imports leave the stored state unchanged, damaged storage is set aside with a notice, and the sanitizer removes injected `onerror` and `javascript:` attributes without breaking the widgets. | Review by the user |
| Questions written with `type` instead of `kind` worked by accident; now an error. Markdown export flattened code in question prompts. Citation numbering rule documented and checked. function-lab misjudged predictions when the slider moved down. | Mathematics and Kubernetes benchmark agents |
| Rule that horizontal concepts connect through hubs, not prerequisites; what counts as observation evidence for dispositions; archived copies for blocked official pages; warning when lessons exceed the requested total time. | Social-science benchmark agent |
| Documentation of the stepper gate semantics, the two kinds of debrief, `sortKey`, `api.record` semantics, kicker keys, `source-compare` `citation`, the global SVG arrow marker, and `init` output. | All agents |

## Limitations (honest)

- **Claude Code automatic discovery** was not exercised end to end. A headless `claude -p` test in a project containing only `.claude/skills/interactive-course-builder/` failed before running, because the CLI's OAuth session on this machine had expired. The installation layout follows the official documentation, and the frontmatter is checked by test. To reproduce the test after `claude` login:

  ```bash
  mkdir -p /tmp/lk-try/.claude/skills && cp -R skills/interactive-course-builder /tmp/lk-try/.claude/skills/ && cd /tmp/lk-try && claude -p "Which skill would you use to build an interactive course on bird songs?"
  ```

- **No real learners** have used any course. Educational effectiveness is unmeasured. The pilot protocol exists but has not been run.
- **Rubric scores are self-reviews.** No independent reviewer has scored the benchmark courses.
- **Not tested:** Firefox, Safari, mobile hardware, screen readers, real printing or PDF output.
- **Validation is structural.** It cannot judge whether `assesses` is meaningful, whether a quotation matches its source, or whether a model answer is correct. Those need research and review.
- **Partial examples.** History and Spanish are partial by design (curriculum plus complete lessons). Their pending work is recorded, not hidden.
- **UI strings** ship in English and Spanish only. In other course languages the interface and Markdown headings fall back to English unless every string is translated in `course.ui`. The skill description says so, and `check-request` and `validate` warn.
