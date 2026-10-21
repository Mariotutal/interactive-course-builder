# Course and lesson contract (format 1)

A course source directory looks like this:

```
my-course/
  course.json            # manifest: outcomes, modules, glossary, routes, diagnostic, capstone
  lessons/<lesson-id>.json
  widgets/*.js           # optional course-specific activities (see activities.md)
  assets/                # local images/audio, referenced as assets/...
```

`node scripts/lk.mjs build my-course` validates the source and writes:

- `my-course/site/`: an offline web app; open `site/index.html`.
- `my-course/markdown/`: one Markdown file per lesson.
- `my-course/markdown/assets/`: copies of local assets, so image references also work in Markdown.
- `my-course/COVERAGE.md`: the coverage report.

Never edit the generated `site/content.js`. With `--out <dir>`, the site goes to `<dir>`, but `markdown/` and `COVERAGE.md` always stay in the course folder. The builder refuses to delete an output folder that is the course folder, one of its parents, or a non-empty folder without its `.lk-build` marker.

All ids are stable lowercase slugs. Learner state is keyed by these ids, so **never rename an id that learners may have used**. If you change the content of a question or activity, its content hash changes and saved answers to it are discarded on the learner's next visit. This prevents old results from being reused.

## course.json

```json
{
  "format": 1,
  "id": "intro-stats-ci",
  "version": "1.0.0",
  "title": "…", "subtitle": "…",
  "language": "en", "locale": "en-US", "dir": "ltr",
  "learner": { "…": "the whole normalized learning request (the object written by init; fields as in input-contract.md, e.g. learner.learner.startingKnowledge)" },
  "assumptions": ["Unknown: learner.background → default …", "Simulations use pseudo-random draws; results vary"],
  "intro": "<p>HTML shown on the home page: why this course, how it works, prerequisites.</p>",
  "outcomes": [ { "id": "o1", "text": "Explain … (observable verb)", "level": "core" } ],
  "modules": [ { "id": "m1", "title": "…", "summary": "…", "prerequisites": [], "lessons": ["lesson-a", "lesson-b"] } ],
  "routes": [ { "id": "core", "title": "Core route", "description": "…", "lessons": ["lesson-a"] }, { "id": "advanced", "title": "…", "lessons": ["…"] } ],
  "//routes": "A core route is expected; the validator warns if there are no routes. Add an advanced route only when the course has substantive advanced lessons.",
  "glossary": [ { "term": "standard error", "aka": ["SE"], "definition": "…" } ],
  "diagnostic": { "intro": "<p>…</p>", "fastLabel": "quick pass", "fullLabel": "study fully",
                  "questions": [ { "id": "dg1", "prompt": "…", "options": ["…"], "correct": 1, "explanation": "…", "lessons": ["lesson-a"] } ] },
  "capstone": { "id": "capstone", "title": "…", "task": "<p>A new situation that uses several outcomes…</p>",
                "levels": ["Beginning", "Developing", "Proficient"],
                "rubric": [ { "criterion": "…", "descriptors": ["…", "…", "…"] } ],
                "assesses": ["o1", "o2"], "evaluation": "<p>How to get human or external feedback, if needed.</p>", "model": "<p>Exemplar…</p>" },
  "sources": [ { "title": "…", "kind": "textbook", "author": "…", "date": "2019" } ],
  "review": { "intervals": [1, 3, 7, 21, 60] },
  "ui": { "start": "Begin" },
  "//ui": "Overrides for interface strings (keys in assets/runtime/lk-i18n.js). Built-in strings exist for en and es. For other languages translate every key here, or the interface and Markdown headings fall back to English.",
  "theme": { "profile": "mathematics", "accent": "#1f5f8b" }
}
```

`init` writes `version: "0.1.0"`, an `id` derived from the topic (rename it before anyone studies the course, since ids are stable afterwards), empty `outcomes` and `modules`, and `request.normalized.json` next to `course.json` for reference.

Every outcome must be **taught** by at least one lesson (`lesson.outcomes`) and **assessed** by at least one check question, transfer task or the capstone (`assesses`). The validator enforces both.

### Visual profile and options

`theme.profile` changes the palette and emphasis of the offline app without changing the course data. Choose one based on the material: `mathematics`, `systems`, `programming`, `social-science`, `science` or `languages`; use `general` when no profile fits. See [domain-toolkit.md](domain-toolkit.md) for the visual grammar and interactions that match each profile.

The other options exist only where they serve learning. The `//` comments in this example are explanations only; remove them in `course.json`:

```json
"theme": {
  "profile": "mathematics",
  "typeScale": "large",          // compact | standard | large — legibility (e.g. younger learners, long formulas)
  "diagramStyle": "outline",     // filled | outline | high-contrast — diagram clarity; high-contrast for low vision
  "layout": "reading",           // standard | reading | wide — line length; reading for prose-heavy courses
  "codeTheme": "auto",           // auto | light | dark — code readability
  "tokens": { "light": { "accent": "#5b3f9e" }, "dark": { "accent": "#c9b6ff" } }
}
```

- **`tokens`.** Overrides `accent`, `accent2`, `ok`, `warn` and `danger`, separately for the light and the dark mode. These colours are used for text such as links and status, so the validator rejects any value below 4.5:1 contrast (WCAG AA) against that mode's backgrounds.
- **`theme.accent`.** Still accepted. It must reach 4.5:1 against the light backgrounds.
- **Unknown keys.** They are ignored with a warning. There is no illustration-style option: decoration without a learning job does not belong in the theme.

## Knowledge architecture (optional)

Add `knowledgeArchitecture` to `course.json` when knowledge is not a single chain, for example several interacting topics, cross-cutting lenses, or dispositional goals. Skip it for short procedural courses: lesson prerequisites still work without it.

```json
"knowledgeArchitecture": {
  "summary": "One sentence on how the knowledge is structured.",
  "concepts": [
    { "id": "slope", "label": "Slope", "type": "hierarchical", "lessons": ["slope-intercept"] },
    { "id": "rate-of-change", "label": "Rate of change as a lens", "type": "horizontal", "lessons": ["slope-intercept", "line-review"] }
  ],
  "prerequisites": [ { "from": "slope", "to": "evaluate-linear" } ],
  "hubs": [ { "id": "change", "label": "Change", "lens": "Every model describes how one quantity changes with another", "concepts": ["slope", "rate-of-change"] } ],
  "dispositions": [ { "id": "check-models", "label": "Checking a model against known values", "lessons": ["slope-intercept"],
                      "bands": [ { "level": 1, "descriptor": "Accepts results unchecked" }, { "level": 2, "descriptor": "Checks when prompted" }, { "level": 3, "descriptor": "Checks and states limits unprompted" } ] } ],
  "assessmentModes": { "slope": "auto", "rate-of-change": "rubric", "check-models": "observation" }
}
```

- **Rule for horizontal concepts.** Do not draw prerequisite edges to or from them (the validator warns); connect them through `hubs`.
- **Concept types.** A `hierarchical` concept builds on prerequisites (an algebra procedure, a Kubernetes object model). A `horizontal` concept is a lens that reappears across topics (causation, rate of change, trade-offs). It is usually assessed by reasoning and connected through hubs rather than prerequisite edges.
- **Dispositions.** Dispositions (habits of mind) have at least two progression bands. They are never auto-scored.
- **Assessment modes.** Every concept and disposition needs one:
  - `auto`: tagged non-open questions;
  - `rubric`: tagged open questions, transfer tasks, rubric practice or the capstone;
  - `observation`: a tagged real-world practice, or one with `externalFeedback`. One such task per disposition is the minimum the validator accepts. A real progression needs the bands to be observed more than once, so plan at least one task per module that teaches the disposition.
- **Errors.** The validator rejects unknown ids, prerequisite cycles, hubs with fewer than two concepts, missing modes, and auto-scored dispositions.
- **Warnings.** It warns when a prerequisite is taught after its dependent, and when a mode has no matching evidence.
- **Concept tags.** Tag items with `concepts: [ids]` on `check` questions, `predict`, `practice`, `transfer`, `activity` and `capstone`. Tagged auto-checked questions feed the learner's concept review. Each concept's evidence appears in `COVERAGE.md`.
- **In the app.** The Map page shows the architecture as tables, not a decorative graph. Progress shows the retrieval history per concept. Review schedules due concepts.


## lessons/&lt;id&gt;.json

```json
{
  "format": 1, "id": "lesson-a", "title": "…", "summary": "one sentence", "level": "core", "profile": "full", "minutes": 35,
  "outcomes": ["o1"], "prerequisites": [], "prereqText": "<p>Optional: what to know first and where to review it.</p>",
  "exemptions": { "worked": "Justification of at least 20 characters, e.g. a pure listening lesson where a worked example is replaced by a modelled dialogue." },
  "blocks": [ … ],
  "sources": [ { "id": "source-a", "title": "…", "kind": "official", "url": "https://…", "accessed": "2026-10-20", "note": "section 3" } ],
  "next": "<p>How this connects to the next lesson.</p>"
}
```

### Lesson profiles and required functions

Every lesson declares a `profile`. When it is omitted, the profile is `full`.

- **`full`**: for lessons that introduce or develop an idea. Every function in the table is required, unless an `exemptions` entry gives a reason (at least 20 characters).
- **`focused`**: for short review, drill, listening, reading or consolidation lessons. Only `motivate`, `explain`, `check` (at least 1 question) and `sources` are required. Add any other function where it helps.

Transfer is also checked across the whole course: each outcome should be assessed by at least one `transfer` block or by the capstone. The validator warns when one is not.

| Function | Satisfied by | `full` | `focused` |
|---|---|---|---|
| `motivate` | `motivate` block: an authentic problem, question, artifact or situation | required | required |
| `explain` | `explain` block(s): mechanisms, evidence, alternatives, limitations, at the requested depth | required | required |
| `visual` | `visual` block with `alt` (a text equivalent of at least 40 characters) and `purpose` | required | optional |
| `worked` | `worked` block with at least 2 steps | required | optional |
| `predict` | `predict` block, **or** an `activity` that requires predicting, interpreting or deciding | required | optional |
| `practice-guided` | `practice` with `level: "guided"` (hints) | required | optional |
| `practice-independent` | `practice` with `level: "independent"` (less or no help) | required | optional |
| `check` | `check` block(s) whose questions declare `assesses` | required, at least 2 questions in total | required, at least 1 question |
| `transfer` | `transfer` block: a **different** situation from the examples, with a rubric or model answer and `assesses` | required | optional (course-level rule still applies) |
| `own-words` | `reflect` block, or an open question in a `check` | required | optional |
| `sources` | at least one entry in `sources` | required | required |

`COVERAGE.md` shows each lesson's profile and marks every function as present (✓), missing (✗), exempt, or not required (—).

Use `intuition` blocks, with their `limits`, wherever an analogy helps. Order blocks as the learning requires. The usual order is motivate → predict/activity → intuition → visual → explain → worked → practice (guided → independent) → check → transfer → reflect. In a `full` lesson the first prediction comes **before** the first `explain` or `worked` block; `validate` warns otherwise. A prediction is only a prediction if nothing earlier gives the answer away: keep the answer out of earlier visuals, their text equivalents and worked examples, and do not use a term in the prediction that the lesson has not defined yet (link it to the glossary or define it in the prompt). A later predict block is fine when it asks about a new case.

### Block types

All `html` fields are HTML fragments. No `<script>`, `<style>`, inline `on…=` handlers, iframes or forms are allowed. URLs may use only `http`, `https`, `mailto`, `tel`, relative paths, or `data:image/…` in `<img src>`; the validator decodes HTML entities before checking. The app also strips active content at render time.

| type | fields |
|---|---|
| `motivate` | `html` |
| `intuition` | `html`, `limits` (where the analogy or model stops working) |
| `visual` | `html` (a `<figure>` containing an SVG, labelled local image, comparison or chart), `alt` (text equivalent), `purpose` |
| `explain` | `html`, optional `title` |
| `worked` | `title`, optional `html`, `steps: [{ prompt?, html, selfExplain? }]`, optional `result`. A `selfExplain: true` step hides its `html` behind "show" so the learner explains the step first. |
| `predict` | `id`, `prompt`, then **either** `options`, `correct`, `feedback: {"<wrong index>": "misconception explained"}`, `explanation` **or** `kind: "open"` with `model`/`rubric`. Prediction is formative: it does not count as assessing an outcome (use `check` or `transfer` for that), but it may carry `concepts` |
| `activity` | `id`, `widget`, `config`, `instructions` (what to try and what to think about), `debrief` (what they should have noticed), optional `assesses` |
| `practice` | `id`, `level` (`guided`/`independent`), `task`, `hints[]`, `rubric[]` (self-check criteria), `solution` or `model`, `setting` (`in-app`/`offline`/`real-world`), `externalFeedback` (how to get feedback the browser cannot give) |
| `check` | optional `html`, `questions: [question]` |
| `transfer` | `id`, `task`, `rubric[]`, `model`, `assesses[]` |
| `reflect` | `id`, `prompt` |
| `prose`, `callout` | `html`; `callout.tone` is `info`, `tip`, `warn` or `danger`. Start a callout with a bold word so the meaning does not rely on color. |

### Questions

Questions appear in `check.questions`, in `predict`, and in `diagnostic.questions`.

The field is **`kind`**, not `type`; the validator rejects `type`.

- **`mcq`** (the default when `options` is present): `id`, `prompt`, `options[]`, `correct` (index), `explanation` (reasoning), `feedback` (per wrong option: which misconception it reveals), `assesses[]`.
- **`multi`:** `correct` is an array of indexes.
- **`numeric`:** `answer`, `tolerance`, `unit`, `explanation`, optional `feedbackWrong`.
- **`open`:** `prompt`, `rubric[]` (criteria the learner checks off, labelled *self-assessed*), and/or `model`.

The learner's **first attempt** is recorded as performance; later attempts are practice. Open answers are never auto-graded.

### Inline helpers inside html

- **Inline original-source citation:** give the lesson source an `id` and `url`, then cite beside the claim with `<a data-source="source-a">[1]</a>`. The builder verifies the id and resolves the link in the site and Markdown. Link to a specific section, figure or timestamp when possible. Ordinary explicit `<a href="https://…">…</a>` links also work.
  If the link text is a number in brackets (`[2]`), it must be the source's 1-based position in the lesson's `sources` list; the validator warns on a mismatch. In the site and the Markdown export the citation links to the source's URL.
- **Local image:** put a licensed or generated file under the course's `assets/` folder and use `<figure><img src="assets/example.webp" alt="What the image shows"><figcaption>What to notice · Creator, original source, license or generated status <a data-source="image-source">[source]</a></figcaption></figure>`. Keep the block's `alt` as a fuller text equivalent that conveys the teaching point. The builder checks the file and copies it to both outputs. Remote image URLs need network and produce a warning.
- **Glossary term:** `<span class="term" data-term="standard error">standard error</span>`. The term must exist in `course.glossary` (term or alias).
- **Illustrative data:** `<div class="output" data-label="Illustrative data — not a real measurement"><pre>…</pre></div>`. If `data-label` is omitted, a default label is used.
- **Mock interfaces:** `<figure class="mockup" data-label="Mockup — not a screenshot">…</figure>`.
- **Callouts and status:** `<div class="callout warn"><strong>Risk:</strong> …</div>`; `<p class="status-ok|status-warn|status-bad">` carries a symbol as well as a color.
- **Labelled commands or procedures** (technical subjects): `<div class="cmd" data-scope="where it runs" data-kind="read|reversible|risky|simulation"><pre><code>…</code></pre></div>`.
- **SVG** uses theme classes so diagrams work in light and dark mode:
  - text: `t`, `ts`, `tm`;
  - node fills: `n1`–`n4`, `n-plain`, `n-warn`;
  - lines: `edge`, `edge dashed`, plus `marker-end="url(#arrow)"` (the page defines the `#arrow` marker once, so SVGs do not need their own `<defs>`);
  - emphasis: `hl` (highlight), `dim`.

## Learner state

State is stored in `localStorage` under `lk:<course id>:v1`; the stored data carries its own `format` (currently **2**). It records:

- `items`: first attempt, last attempt and attempt count per question or activity, plus its content hash;
- `texts`: open responses and notes;
- `criteria`: self-checked rubric items;
- `visited`: per-lesson visit date;
- `confidence`: 1–4 per lesson, self-rated;
- `reviews`: completed spaced reviews per lesson (used when the course has no knowledge architecture);
- `concepts` (format 2): per concept, the date it was introduced and its retrieval events. An event is a first attempt in a lesson or in a review session. The record also holds the current interval step and the next due date. A correct retrieval moves to the next interval in `course.review.intervals`; a wrong one returns to the first. This is a history used for scheduling, never a mastery score.

**Formats and migration.**
- Format 1 data (from earlier builds) is migrated on load or import. Answers, notes, visits and confidence are kept.
- Concept history is rebuilt from the original visit dates and dated first attempts, and the learner sees a notice.
- Imports are validated field by field. Files from another course, or with a malformed structure, are refused before anything is replaced.
- Damaged stored data is set aside under `lk:<course id>:v1:damaged`.
- Reset deletes everything for the course.

The validation and scheduling logic lives in `assets/runtime/lk-state.js` (testable in Node).
