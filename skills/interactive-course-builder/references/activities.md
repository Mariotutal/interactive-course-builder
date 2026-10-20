# Activities: choosing and configuring interaction patterns

**Two debriefs.** The activity block's `debrief` appears in a collapsible "What you should have noticed" panel under the activity. Some patterns (`classify`, `timeline` ordering, `cloze`, `evidence-case`) also accept a `config.debrief`, shown inside the widget after the learner checks an answer.

An activity earns its place only if the learner has to **think**: predict, manipulate and explain, gather evidence and decide, classify and justify, or produce language. Clicking "next" is not interactivity, and neither is a carousel. Every activity needs `instructions`, which tell the learner what to try and what to look for, and a `debrief`, which says what they should have noticed and why.

## Choose by the kind of knowledge, not by the subject

| The learner must… | Pattern | Typical subjects |
|---|---|---|
| See how outputs depend on inputs; build intuition for a model | `parameter-explorer` (inputs, computed outputs, chart, interpretation rules) | statistics, physics, finance, engineering |
| Reason from evidence to a conclusion; avoid premature conclusions | `evidence-case` | diagnosis, debugging, historiography, medicine, journalism |
| Make sequential decisions with consequences | `scenario` | ethics, management, clinical or safety procedures, negotiation |
| Distinguish categories or apply a definition | `classify` | grammar, taxonomy, fallacies, source types |
| Place events in order, separate established from contested chronology | `timeline` (with optional ordering challenge) | history, biology (life cycles), project histories |
| Compare accounts; attend to author, date and purpose | `source-compare` with open questions, rubric and model | history, literature, law, media literacy |
| Understand and produce spoken or written language in context | `dialogue` (lines, optional speech synthesis, comprehension, typed production) | language learning, interviewing |
| Recall and produce exact forms | `cloze` | vocabulary, conjugation, formulas, code syntax |
| Locate and name parts of a structure | `hotspot-diagram` (explore mode plus find-it quiz) | anatomy, architecture, interfaces, maps |
| Follow a process, predicting each step | `stepper` (a predict gate before a step is revealed) | algorithms, proofs, chemical or physiological processes |
| Something else, such as a stochastic simulation or a domain manipulative | a **custom widget** in the course's `widgets/` folder | — |

Some practice cannot be verified by a browser: speaking with a person, a physical skill, lab work, writing judged by an expert. Use a `practice` block with `setting: "real-world"`, concrete criteria (`rubric`) and `externalFeedback` saying who or what can give feedback. Never pretend the app can judge it.

Every model is a simplification. List the simplifications in `config.assumptions`, which is required for `parameter-explorer` and for custom widgets. Mark illustrative data as illustrative. Never present a simulation as a precise prediction.

## Configuration reference

All text fields accept HTML unless noted otherwise. `title` and `intro` are optional on every pattern. Labels are localized through the UI strings.

### parameter-explorer

```json
{ "title": "Width of a 95% interval",
  "inputs": [ { "id": "n", "label": "Sample size n", "min": 5, "max": 400, "step": 5, "value": 30 },
              { "id": "s", "label": "Standard deviation", "min": 1, "max": 30, "step": 1, "value": 10 } ],
  "outputs": [ { "id": "se", "label": "Standard error", "expr": "s / sqrt(n)", "format": { "digits": 2 } },
               { "id": "moe", "label": "Margin of error", "expr": "1.96 * s / sqrt(n)" } ],
  "chart": { "x": { "var": "x", "from": 5, "to": 400 }, "series": [ { "label": "margin of error vs n", "expr": "1.96 * s / sqrt(x)" } ],
             "markers": [ { "label": "current n", "x": "n" } ], "xLabel": "n", "yLabel": "margin of error" },
  "interpret": [ { "when": "n < 30", "tone": "warn", "html": "With small n the normal approximation is shakier…" } ],
  "assumptions": ["Known population SD; z = 1.96 instead of a t quantile", "Simple random sampling"] }
```

Expressions use a **safe evaluator**, with no `eval`. It supports numbers, input ids, `+ - * / ^ %`, comparisons, `&& || !`, `a ? b : c`, the constants `pi` and `e`, and these functions:

- general: `abs sqrt exp ln log log10 log2 sin cos tan asin acos atan floor ceil round(x,d) min max pow sign clamp(x,a,b)`;
- statistics: `erf normpdf(x,mu,s) normcdf(x,mu,s) norminv(p,mu,s) tcdf(t,df) tinv(p,df) choose(n,k) binompmf(k,n,p) lgamma`.

Numbers are formatted for the course language (for example `3,00` in Spanish).

Chart series may use the chart variable (`x.var`, default `x`). The validator parses every expression and rejects unknown variables.

### evidence-case

```json
{ "situation": "<p>Symptom or question…</p>", "question": "Which conclusion is best supported?",
  "evidence": [ { "id": "e1", "label": "Read the ship's log", "source": "Archive X, 1770", "content": "<p>…</p>", "reading": "<p>What this shows and does not show…</p>", "key": true },
                { "id": "e2", "label": "Run the test", "terminal": true, "content": "plain text shown as a labelled simulated terminal" } ],
  "conclusions": [ { "id": "c1", "label": "…", "verdict": "best", "explanation": "…" },
                   { "id": "c2", "label": "…", "verdict": "defensible", "explanation": "…" },
                   { "id": "c3", "label": "…", "verdict": "wrong", "explanation": "…" } ],
  "debrief": "<p>…</p>", "terminalLabel": "Simulated output — illustrative", "assumptions": [] }
```

`verdict` is one of `best`, `defensible`, `weak` or `wrong`. Use several `defensible` conclusions when the field genuinely allows competing interpretations. The debrief lists any key evidence the learner did not examine.

### scenario

```json
{ "start": "n1", "nodes": {
    "n1": { "title": "Day 1", "html": "<p>…</p>", "choices": [ { "label": "…", "next": "n2", "quality": "good", "feedback": "…" }, { "label": "…", "next": "n3", "quality": "poor", "feedback": "…" } ] },
    "n2": { "html": "<p>…</p>", "end": true, "debrief": "<p>…</p>" } } }
```

### classify

```json
{ "categories": [ { "id": "fact", "label": "Statement of fact" }, { "id": "opinion", "label": "Opinion" } ],
  "items": [ { "id": "i1", "html": "…", "category": "fact", "feedback": "why" } ], "debrief": "<p>…</p>" }
```

### timeline

```json
{ "events": [ { "id": "e1", "date": "5 Mar 1770", "sortKey": 1770.18, "title": "…", "html": "<p>…</p>", "tags": ["politics"], "status": "established", "sources": ["…"] } ],
  "orderingChallenge": { "prompt": "Put these in order", "eventIds": ["e1", "e3", "e2"], "debrief": "<p>…</p>" },
  "statusLabels": { "contested": "date disputed" } }
```

`sortKey` is any number that increases with time; it is used for ordering only. A decimal year works, for example 1770.18 for early March 1770; for BCE dates use negative numbers. `status` is `established`, `contested` or `uncertain`. Contested and uncertain events are marked visually and in text.

### source-compare

```json
{ "sources": [ { "id": "s1", "title": "…", "author": "…", "date": "…", "type": "engraving / deposition / letter", "provenance": "who made it, for whom, when", "excerpt": "<p>Short verified excerpt…</p>", "translation": "<p>…</p>", "note": "…", "citation": "Edition, URL, accessed 2026-10-20" } ],
  "questions": [ { "id": "q1", "prompt": "What did each author want the reader to believe?", "rubric": ["Names the author's purpose", "Cites a detail"], "model": "<p>…</p>" } ] }
```

Excerpts must be quoted exactly from a verified edition and cited in the lesson's `sources`. Respect copyright: use public-domain or short quotations only.

### dialogue

```json
{ "targetLang": "es-ES", "lines": [ { "speaker": "Camarero", "text": "¿Qué le pongo?", "translation": "What can I get you?", "note": "le = usted form" } ],
  "comprehension": [ { "prompt": "…", "options": ["…"], "correct": 0, "explanation": "…", "feedback": { "1": "…" } } ],
  "production": [ { "prompt": "Order a coffee with milk, politely", "accept": ["un café con leche, por favor", "me pone un café con leche"], "accentSensitive": false, "accentHint": "…", "tips": "<p>…</p>", "model": "<p>…</p>" } ],
  "rate": 0.9 }
```

`accentSensitive` and `accentHint` are set per production item. An answer that differs only in accents gets the hint instead of "incorrect". Every `accept` list must include the form shown as the model.

Audio uses the browser's speech synthesis when it is available. A text fallback is always shown. Synthetic voices are not native-speaker models; say so where pronunciation matters, and point to real recordings in `sources`.

### cloze

`{ "text": "<p>Yo [[soy::ser]] estudiante y [[estoy::estar]] cansado.</p>", "accentSensitive": true, "debrief": "<p>…</p>", "hint": "<p>…</p>" }`. Alternatives are written `[[a|b]]` and hints `[[a::hint]]`.

### hotspot-diagram

```json
{ "svg": "<svg viewBox='0 0 400 200' role='img' aria-label='…'><rect id='part-a' …/></svg>", "alt": "Text description…",
  "hotspots": [ { "id": "a", "label": "Lens", "target": "part-a", "html": "<p>…</p>" } ],
  "quiz": [ { "ask": "Where is the focal point?", "answer": "a", "feedback": "…", "wrong": { "b": "…" } } ] }
```

### stepper

A step's `predict` gates **that** step: its `html` stays hidden, and Next stays disabled, until the learner answers.

`{ "steps": [ { "title": "…", "html": "<p>…</p>", "predict": { "prompt": "What happens next?", "options": ["…"], "correct": 1, "explanation": "…" } } ] }`

## Custom widgets (extension point)

Put a file in the course's `widgets/` folder. The core package is never edited:

```js
LK.registerWidget('sampling-sim', {
  title: 'Sampling simulator', kind: 'w_explore',
  mount(el, config, api) {
    // api.t(key), api.esc(str), api.lang, api.id (activity id), api.expr (safe evaluator), api.fmt(value, digits) (locale-aware)
    // api.record(data): marks the activity attempted. Every call increments the attempt count and stores data,
    //   so call it on meaningful interactions (a run, a submitted answer), not on every keystroke.
    el.innerHTML = `<p class="w-title" data-kicker="${api.esc(api.t('w_explore'))}">${api.esc(config.title)}</p>…`;
  },
});
```

Kicker labels (`kind`) are UI-string keys: `w_explore`, `w_investigate`, `w_decide`, `w_classify`, `w_analyze`, `w_listen`, `w_produce`, `w_walkthrough`. The validator only checks that the widget is registered and warns when `config.assumptions` is missing. It cannot check a custom widget's own config, so validate it inside `mount` and show an error message.

Rules for custom widgets:

- Every control must work and be keyboard operable.
- Use `aria-live` for results.
- State `config.assumptions`.
- Use a seeded or clearly labelled random generator for simulations.
- Make no network calls.
- Do not read or write `localStorage` directly; use `api.record`.

The validator checks that the widget is registered.
