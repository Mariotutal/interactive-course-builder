# REVIEW (self-review by the authoring model; not an independent evaluation)

Course: linear vs exponential growth (3 lessons + capstone, benchmark size). Rubric from the skill's quality-rubric.md, 0-2 per criterion. These scores are my own judgement and do not prove the course teaches well.

| Criterion | L1 tell-them-apart | L2 build-the-models | L3 where-models-break | Notes |
|---|---|---|---|---|
| Accuracy | 2 | 2 | 1 | Definitions and comparisons trace to OpenStax Algebra and Trigonometry 2e 4.1, 6.1, 6.8 (accessed 2026-10-20) but were read through a summarising fetch tool, so they are paraphrased, not quoted. L3's logistic formula is my simplified form, labelled as a course decision. All arithmetic recomputed with Node. |
| Prerequisite clarity | 2 | 2 | 2 | Glossary terms are linked; prereqText present. |
| Depth | 2 | 2 | 1 | L3 is the thinnest (no worked logistic fit by design). |
| Interaction quality | 2 | 2 | 2 | classify, function-lab (predict-gated) and parameter-explorer. Opened in a browser: function-lab tasks and sliders render, slider is locked until prediction; parameter-explorer readouts and interpretation text update. Not every control was exercised. |
| Feedback | 2 | 2 | 2 | Every MCQ wrong option has misconception feedback (validator reports 0 warnings). |
| Accessibility | 1 | 1 | 1 | Visuals have alt text and dashed/solid + labels (not colour alone). Not tested: 375 px layout, keyboard-only use, screen reader, print view. |
| Transfer | 2 | 2 | 2 | New contexts (app users, draining tanks, bike-share) plus capstone. |
| Usability | 2 | 2 | 2 | About 30 minutes each is a time estimate, not measured. |

## Verified
- `validate`: 0 errors, 0 warnings. `build`: 0 errors, 0 warnings. COVERAGE.md shows every outcome taught and assessed, every full function present.
- Browser (local http server): home page, lesson 2 widget, lesson 3 explorer loaded and showed expected readouts.

## Not verified / limitations
- Common Core HSF.LE wording: official corestandards.org URLs returned 404; only an unofficial mirror was read, so the standard is not cited in the course.
- Quotes: none used; everything is paraphrase of summarised fetches. OpenStax 4.1 page was read only for its first 100,000 of about 104,500 characters.
- OpenStax figure anchor `#Table_04_01_01` was seen only as an internal link target, not confirmed to resolve.
- Datasets are invented and labelled illustrative. No learner testing has been done.
- Interface language is English (matches the request).
