# Evaluation harness

This folder is for maintainers of `interactive-course-builder`. It is not part of the installable skill.

It answers one question before the tool grows further: **does a change make courses better, or only longer?**

| Piece | What it is |
|---|---|
| `benchmarks/*.request.json` | Four fixed learning requests: mathematics, Kubernetes, programming and social science (Spanish). Their learner profiles are synthetic. |
| `courses/<name>/` | The course generated for each benchmark by a fresh agent using only the skill. The source is committed; `site/` and `markdown/` are generated. |
| `rubric.json` | Seven criteria, each scored 0–2 with descriptors and how to check it: factual accuracy, instructional sequencing, visual purpose, interaction relevance, accessibility, source quality and transfer coverage. |
| `lk-eval.mjs` | `auto` runs the automatic checks and metrics; `report` aggregates the results into `RESULTS.md`; `pilot` summarises learner exports. |
| `results/<name>/auto.json` | Automatic results: validation, output integrity (it builds into a temporary folder and inspects the bundle, hashes, Markdown and widgets), and content metrics. |
| `results/<name>/manual.json` | Manual rubric scores, each with a rationale. `independent` records whether the reviewer did not author the course or the tool. |
| `RESULTS.md` | Generated summary. |
| `PILOT.md` | Protocol for a small pilot with real learners. |

## Run

```bash
for b in mathematics kubernetes programming social-science; do node evaluation/lk-eval.mjs auto evaluation/courses/$b --name $b; done
# then fill in evaluation/results/<name>/manual.json with scores and rationales
node evaluation/lk-eval.mjs report
```

## Regenerating a benchmark course after changing the skill

Give a fresh agent only the skill directory and the benchmark request, and ask for at most 3 complete lessons plus a capstone. Do not tell it which features to use: the benchmark measures what the skill leads to on its own.

Compare against the previous results. Look at the rubric scores and at **density** (interactions per 1000 words, assessment items per outcome), not at word count.

## How to read the results

- **Automatic metrics describe the artifact.** A high number of interactions does not prove learning.
- **Self-reviews are not independent.** Scores are marked as self-review when the tool's author or the generating model gave them. An independent reviewer is better.
- **Learning needs learners.** Only a pilot with real learners can show learning outcomes, and with a handful of learners it shows problems more reliably than benefits.
