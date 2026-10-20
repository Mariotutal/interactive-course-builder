# REVIEW (self-review by the authoring model, not an independent evaluation)

This review was written by the model that authored the course. It does not prove that the course teaches well. No real learner has used it.

## What was run and observed
- `lk.mjs validate` and `lk.mjs build`: 0 errors, 0 warnings (after adding `accessed` dates to course-level web sources).
- Served `site/` over local HTTP and opened it in the browser pane: the corroboration lesson rendered (timeline, evidence-case, MCQs), no console errors; a wrong MCQ option, an evidence item and a conclusion each showed their feedback text; at 375 px emulation the page did not overflow horizontally (document width equal to viewport), but one SVG measured wider than the viewport, probably inside a scroll container (not inspected further).
- Not tested in a browser: source-compare open answers and rubric ticking, classify, progress export/import, glossary popover by keyboard, print view, the first lesson visually.

## Scores (0-2)
| Criterion | Sourcing lesson | Corroboration lesson | Notes |
|---|---|---|---|
| Accuracy | 1 | 1 | Facts and quotations come from MHS pages fetched 2026-10-20, but the fetch tool passed pages through a summarizing model, so quotation exactness rests on that layer and needs human re-check. Several claims are explicitly flagged unverified. |
| Prerequisite clarity | 2 | 2 | Terms are in the glossary; context box given. |
| Depth | 2 | 2 | Worked examples show reasoning; limits and alternatives covered. Only one event and two accounts. |
| Interaction quality | 2 | 2 | Classify with misconception feedback; source-compare, timeline, evidence-case with several defensible conclusions. |
| Feedback | 2 | 2 | Wrong options name misconceptions; open tasks have rubrics and models. |
| Accessibility | 1 | 1 | Text equivalents for both SVGs; keyboard operation and color-independence rely on the runtime and were not tested. |
| Transfer | 2 | 2 | Invented modern scenarios, labelled illustrative. |
| Usability | 2 | 2 | Each lesson is sized to 45 minutes by design, which was not timed with a learner. |

## Known limitations
- Only 2 of the planned lessons exist; o3 (writing a claim) is taught in one lesson plus the capstone; see PROGRESS.md.
- No images included: the engraving is described and linked. Image content (who is shown doing what) is deliberately left for the learner to observe, because I did not inspect the image.
- No depositions are included; the Founders Online edition (Adams Legal Papers) and the LOC record could not be fetched (JS-rendered page returned no text; LOC returned HTTP 403).
- Preston account and Gazette report were quoted as short selected phrases only; the full passages should be read by the learner on MHS.
- The verdict labels (best/defensible/weak/wrong) are the author's judgment, flagged as such.
- The claim that the Gazette was Patriot-aligned is not asserted as fact; flagged as unverified.
